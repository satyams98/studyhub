import { Link } from '../router'
import { courses } from '../data'
import { useProgress } from '../context/ProgressContext'
import { BookOpen, ArrowRight } from 'lucide-react'

export default function HomePage() {
  const { completed } = useProgress()

  return (
    <main className="main no-sidebar">
      {/* ── Hero ─────────────────────────────── */}
      <div className="catalog-hero">
        <div className="catalog-eyebrow">Study Companion</div>
        <h1 className="catalog-title">
          Your Field Guide to<br />
          <span className="catalog-title-accent">Technical Mastery</span>
        </h1>
        <p className="catalog-desc">
          Curated, text-based study guides compiled from top video courses.
          Pick a course below and learn at your own pace — no video scrubbing required.
        </p>
      </div>

      {/* ── Course Grid ──────────────────────── */}
      <div className="catalog-section-label">Available Courses</div>

      <div className="catalog-grid">
        {courses.map((course) => {
          const doneCount = course.allLessons.filter(
            (l) => completed.has(`${course.slug}:${l.id}`)
          ).length
          const pct = course.totalLessons
            ? Math.round((doneCount / course.totalLessons) * 100)
            : 0

          return (
            <Link
              key={course.slug}
              to={`/course/${course.slug}`}
              className="catalog-card"
              style={{ '--card-accent': course.color }}
            >
              <div className="catalog-card-color" style={{ background: course.color }} />
              <div className="catalog-card-body">
                <div className="catalog-card-tags">
                  {course.tags?.map((t) => (
                    <span key={t} className="catalog-tag">{t}</span>
                  ))}
                </div>
                <h2 className="catalog-card-title">{course.title}</h2>
                <p className="catalog-card-desc">{course.description}</p>
                <div className="catalog-card-stats">
                  <span className="stat-chip"><BookOpen size={13} /> {course.sections.length} Sections</span>
                  <span className="stat-chip">{course.totalLessons} Lessons</span>
                </div>
                <div className="catalog-card-progress">
                  <div className="catalog-card-bar">
                    <div
                      className="catalog-card-fill"
                      style={{ width: `${pct}%`, background: course.color }}
                    />
                  </div>
                  <span className="catalog-card-pct">{pct}%</span>
                </div>
                <div className="catalog-card-cta">
                  {doneCount > 0 ? 'Continue' : 'Start Learning'}
                  <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          )
        })}

        {/* Placeholder for future courses */}
        <div className="catalog-card placeholder">
          <div className="catalog-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div style={{ textAlign: 'center', color: 'var(--text-mute)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
              <div style={{ fontSize: 14 }}>More courses coming soon</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────── */}
      <footer className="catalog-footer">
        <p>An independent study companion — compiled from Udemy course transcripts into a navigable, text-first format.</p>
      </footer>
    </main>
  )
}
