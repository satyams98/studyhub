// Per-lesson chat history, persisted in IndexedDB — same approach as
// src/context/ProgressContext.jsx, but keyed by "<courseSlug>:<lessonId>"
// and storing an array of {role, content} messages instead of a boolean.

const DB_NAME = 'study-hub-chat'
const DB_VERSION = 1
const STORE_NAME = 'lessonChats'

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

export async function loadChatHistory(key) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

export async function saveChatHistory(key, messages) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(messages, key)
  } catch {
    // best-effort persistence — a lost write just means history isn't restored later
  }
}
