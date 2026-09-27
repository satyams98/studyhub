import { useRoute, useParams } from '../router'
import { Menu, ArrowRight, Home, Sun, Moon, Search } from 'lucide-react'
import { getCourse } from '../data'
import { useProgress } from '../context/ProgressContext'
import { useTheme } from '../context/ThemeContext'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || '')

export default function TopNav({ onMenuClick, onSearchClick }) {
  const { path, navigate } = useRoute()
  const { courseSlug } = useParams()
  const { completed } = useProgress()
  const { theme, toggleTheme } = useTheme()
  const course = getCourse(courseSlug)

  const handleContinue = () => {
    if (!course) return
    const next = course.allLessons.find((l) => !completed.has(`${courseSlug}:${l.id}`)) || course.allLessons[0]
    if (next) navigate(`/course/${courseSlug}/${next.sectionSlug}/${next.slug}`)
  }

  const doneCount = course
    ? course.allLessons.filter((l) => completed.has(`${courseSlug}:${l.id}`)).length
    : 0

  return (
    <header className="topnav">
      {courseSlug && (
        <button className="topnav-menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
          <Menu size={18} />
        </button>
      )}
      <div className="topnav-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <span className="mark">Study Hub</span>
        {course && <span className="tag">// {course.subtitle}</span>}
        {!course && <span className="tag">// course companion</span>}
      </div>
      <nav className="topnav-tabs">
        <a
          href="#/"
          className={`topnav-tab${!courseSlug ? ' active' : ''}`}
          onClick={(e) => { e.preventDefault(); navigate('/') }}
        >
          <Home size={14} style={{ marginRight: 4 }} /> Courses
        </a>
        {course && (
          <>
            <a
              href={`#/course/${courseSlug}`}
              className={`topnav-tab${courseSlug && path === `/course/${courseSlug}` ? ' active' : ''}`}
              onClick={(e) => { e.preventDefault(); navigate(`/course/${courseSlug}`) }}
            >
              Curriculum
            </a>
            <a
              href={`#/course/${courseSlug}/glossary`}
              className={`topnav-tab${path.endsWith('/glossary') ? ' active' : ''}`}
              onClick={(e) => { e.preventDefault(); navigate(`/course/${courseSlug}/glossary`) }}
            >
              Glossary
            </a>
          </>
        )}
      </nav>
      <div className="topnav-right">
        <button className="topnav-search-btn" onClick={onSearchClick} aria-label="Search">
          <Search size={15} />
          <span className="topnav-search-label">Search</span>
          <kbd className="cmdk-kbd">{IS_MAC ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        {course && (
          <>
            <span className="progress-pill">{doneCount} / {course.totalLessons} complete</span>
            <button className="btn-continue" onClick={handleContinue}>
              Continue <ArrowRight size={14} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}
