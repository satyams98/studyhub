import { useEffect, useState } from 'react'
import { Link, useParams } from '../router'
import { ChevronRight, Check, Circle, LayoutDashboard, BookOpen } from 'lucide-react'
import { getCourse } from '../data'
import { useProgress } from '../context/ProgressContext'

export default function Sidebar({ open, onNavigate }) {
  const { courseSlug, sectionSlug, lessonSlug } = useParams()
  const { isComplete } = useProgress()
  const course = getCourse(courseSlug)

  const currentSection = course?.sections.find((s) => s.sectionSlug === sectionSlug)
  const [expanded, setExpanded] = useState(() => new Set(currentSection ? [currentSection.id] : []))

  useEffect(() => {
    if (currentSection) {
      setExpanded((prev) => new Set(prev).add(currentSection.id))
    }
  }, [currentSection])

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!course) return null

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-block">
        <div className="sidebar-eyebrow">Study Tools</div>
        <Link to="/" className="sidebar-link" onClick={onNavigate}>
          <LayoutDashboard size={15} /> All Courses
        </Link>
        <Link to={`/course/${courseSlug}`} className="sidebar-link" onClick={onNavigate}>
          <BookOpen size={15} /> Course Overview
        </Link>
      </div>

      <div className="sidebar-block" style={{ marginBottom: 8 }}>
        <div className="sidebar-eyebrow">Curriculum</div>
      </div>

      {course.sections.map((section) => {
        const isOpen = expanded.has(section.id)
        const isCurrent = section.id === currentSection?.id
        return (
          <div className="module" key={section.id}>
            <button
              className={`module-header${isCurrent ? ' current' : ''}`}
              onClick={() => toggle(section.id)}
            >
              <span className="module-dot" style={{ background: section.color }} />
              <span className="module-num">{String(section.id).padStart(2, '0')}</span>
              <span className="module-title">{section.title}</span>
              {section.optional && <span className="module-optional">Optional</span>}
              <span className={`module-chevron${isOpen ? ' open' : ''}`}>
                <ChevronRight size={14} />
              </span>
            </button>
            {isOpen && (
              <ul className="lesson-list">
                {section.lessons.map((lesson) => {
                  const active = lesson.slug === lessonSlug && section.sectionSlug === sectionSlug
                  const done = isComplete(`${courseSlug}:${lesson.id}`)
                  return (
                    <li key={lesson.id}>
                      <Link
                        to={`/course/${courseSlug}/${section.sectionSlug}/${lesson.slug}`}
                        className={`lesson-link${active ? ' active' : ''}`}
                        onClick={onNavigate}
                      >
                        <span className={`lesson-check${done ? ' done' : ''}`}>
                          {done ? <Check size={13} /> : <Circle size={7} fill="currentColor" strokeWidth={0} />}
                        </span>
                        <span className="lesson-id">{lesson.id}</span>
                        <span className="lesson-link-title">{lesson.title.replace(/^\[THEORY\]\s*/, '')}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </aside>
  )
}
