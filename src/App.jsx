import { useState } from 'react'
import { Router, useRoute, useParams } from './router'
import TopNav from './components/TopNav'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import CoursePage from './pages/CoursePage'
import GlossaryPage from './pages/GlossaryPage'
import LessonPage from './pages/LessonPage'
import { ProgressProvider } from './context/ProgressContext'
import { ThemeProvider } from './context/ThemeContext'
import './App.css'

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { path } = useRoute()
  const { courseSlug, page, sectionSlug } = useParams()

  // Determine which page to show
  let pageEl
  if (!courseSlug) {
    pageEl = <HomePage />
  } else if (page === 'glossary') {
    pageEl = <GlossaryPage />
  } else if (sectionSlug) {
    pageEl = <LessonPage />
  } else {
    pageEl = <CoursePage />
  }

  // Sidebar only shown when inside a course
  const showSidebar = !!courseSlug

  return (
    <>
      <TopNav onMenuClick={() => setMenuOpen((v) => !v)} />
      <div className="layout">
        {showSidebar && (
          <>
            <div className={`backdrop${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
            <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
          </>
        )}
        {pageEl}
      </div>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ProgressProvider>
        <Router>
          <Shell />
        </Router>
      </ProgressProvider>
    </ThemeProvider>
  )
}
