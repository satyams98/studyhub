import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ProgressContext = createContext(null)

const DB_NAME = 'study-hub-progress'
const DB_VERSION = 1
const STORE_NAME = 'completed'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadCompleted() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.getAllKeys()
      req.onsuccess = () => resolve(new Set(req.result))
      req.onerror = () => resolve(new Set())
    })
  } catch {
    return new Set()
  }
}

async function persistAdd(key) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(true, key)
  } catch { /* silent */ }
}

async function persistRemove(key) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
  } catch { /* silent */ }
}

export function ProgressProvider({ children }) {
  const [completed, setCompleted] = useState(() => new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadCompleted().then((set) => {
      setCompleted(set)
      setLoaded(true)
    })
  }, [])

  const toggleComplete = useCallback((lessonId) => {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(lessonId)) {
        next.delete(lessonId)
        persistRemove(lessonId)
      } else {
        next.add(lessonId)
        persistAdd(lessonId)
      }
      return next
    })
  }, [])

  const isComplete = useCallback((lessonId) => completed.has(lessonId), [completed])

  return (
    <ProgressContext.Provider value={{ completed, toggleComplete, isComplete, loaded }}>
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgress() {
  return useContext(ProgressContext)
}
