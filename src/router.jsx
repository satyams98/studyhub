import { createContext, useContext, useEffect, useState, useCallback } from 'react'

// Minimal hash-based router with zero dependency on the URL() constructor —
// robust inside sandboxed preview iframes (about:srcdoc origins break new URL()
// resolution, which is what most router libraries use internally).

function getPath() {
  const h = window.location.hash
  return h && h.length > 1 ? h.slice(1) : '/'
}

const RouterContext = createContext(null)

export function Router({ children }) {
  const [path, setPath] = useState(getPath())

  useEffect(() => {
    const onHashChange = () => setPath(getPath())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((to) => {
    if (window.location.hash === `#${to}`) {
      setPath(to)
      return
    }
    window.location.hash = to
  }, [])

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>
}

export function useRoute() {
  return useContext(RouterContext)
}

export function useNavigate() {
  return useRoute().navigate
}

// URL scheme:
//   #/                                        → Home (all courses)
//   #/course/:courseSlug                       → Course overview (sections)
//   #/course/:courseSlug/glossary              → Course glossary
//   #/course/:courseSlug/:sectionSlug/:lessonSlug → Lesson
export function useParams() {
  const { path } = useRoute()
  const segments = path.split('/').filter(Boolean)

  if (segments[0] === 'course' && segments.length >= 2) {
    const courseSlug = segments[1]
    if (segments[2] === 'glossary') {
      return { courseSlug, page: 'glossary' }
    }
    if (segments.length >= 4) {
      return { courseSlug, sectionSlug: segments[2], lessonSlug: segments[3] }
    }
    return { courseSlug }
  }

  return {}
}

export function Link({ to, className, onClick, children, ...rest }) {
  const { navigate } = useRoute()
  const handleClick = (e) => {
    e.preventDefault()
    onClick?.(e)
    navigate(to)
  }
  return (
    <a href={`#${to}`} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
