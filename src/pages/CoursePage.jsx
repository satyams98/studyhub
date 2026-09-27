import { Link, useParams, useNavigate } from '../router'
import { getCourse } from '../data'
import { useProgress } from '../context/ProgressContext'
import { ArrowRight, BookOpen, ChevronRight } from 'lucide-react'
import { buildCourseMapMermaid } from '../utils'
import MermaidDiagram from '../components/MermaidDiagram'

export default function CoursePage() {
  const { courseSlug } = useParams()
  const navigate = useNavigate()
  const course = getCourse(courseSlug)
  const { completed } = useProgress()

  if (!course) {
    return (
      <main className="main no-sidebar">
        <p>Course not found. <Link to="/">Back to all courses.</Link></p>
      </main>
    )
  }

  const doneCount = course.allLessons.filter((l) => completed.has(`${courseSlug}:${l.id}`)).length
  const pct = course.totalLessons ? Math.round((doneCount / course.totalLessons) * 100) : 0
  const courseMap = course.sections.length > 1 ? buildCourseMapMermaid(course) : null

  const handleContinue = () => {
    const next = course.allLessons.find((l) => !completed.has(`${courseSlug}:${l.id}`)) || course.allLessons[0]
    if (next) navigate(`/course/${courseSlug}/${next.sectionSlug}/${next.slug}`)
  }

  return (
    <main className="main">
      <div className="breadcrumb">
        <Link to="/">Courses</Link>
        <ChevronRight size={11} className="sep" />
        <span>{course.title}</span>
      </div>

      <div className="course-hero">
        <div className="course-hero-badge" style={{ background: `${course.color}22`, color: course.color }}>
          {course.subtitle}
        </div>
        <h1 className="course-hero-title">{course.title}</h1>
        <p className="course-hero-desc">{course.description}</p>

        <div className="course-hero-stats">
          <span className="stat-chip">
            <BookOpen size={14} />
            {course.sections.length} Sections
          </span>
          <span className="stat-chip">
            {course.totalLessons} Lessons
          </span>
          <span className="stat-chip">
            {doneCount}/{course.totalLessons} Complete
          </span>
        </div>

        <div className="home-progress-bar" style={{ maxWidth: 480 }}>
          <div className="home-progress-fill" style={{ width: `${pct}%`, background: course.color }} />
        </div>

        <div className="course-hero-actions">
          <button className="btn-continue" onClick={handleContinue} style={{ background: course.color }}>
            {doneCount > 0 ? 'Continue' : 'Start Learning'} <ArrowRight size={14} />
          </button>
          <Link to={`/course/${courseSlug}/glossary`} className="btn-outline">
            Glossary
          </Link>
        </div>
      </div>

      {courseMap && (
        <>
          <div className="domain-label">Course Map</div>
          <MermaidDiagram code={courseMap} />
        </>
      )}

      <div className="domain-label">Curriculum</div>

      <div className="section-list">
        {course.sections.map((section) => {
          const sectionDone = section.lessons.filter((l) => completed.has(`${courseSlug}:${l.id}`)).length
          const sectionPct = section.lessons.length ? Math.round((sectionDone / section.lessons.length) * 100) : 0
          const first = section.lessons[0]
          return (
            <Link
              key={section.id}
              to={first ? `/course/${courseSlug}/${section.sectionSlug}/${first.slug}` : '#'}
              className="domain-card"
              style={{ '--card-accent': section.color }}
            >
              <div className="domain-card-left">
                <span className="domain-dot" style={{ background: section.color }} />
                <div className="domain-card-body">
                  <div className="domain-card-meta">
                    <span className="domain-card-num">Section {String(section.id).padStart(2, '0')}</span>
                    {section.optional && <span className="module-optional">Optional</span>}
                  </div>
                  <div className="domain-card-title">{section.title}</div>
                  <div className="domain-card-count">
                    {section.lessons.length} {section.lessons.length === 1 ? 'lesson' : 'lessons'}
                  </div>
                </div>
              </div>
              <div className="domain-card-right">
                <div className="domain-progress-ring">
                  <svg viewBox="0 0 36 36" className="progress-ring-svg">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      stroke={section.color}
                      strokeWidth="3"
                      strokeDasharray={`${sectionPct} ${100 - sectionPct}`}
                      strokeDashoffset="25"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="progress-ring-text">{sectionPct}%</span>
                </div>
                <ChevronRight size={18} className="domain-card-arrow" />
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
