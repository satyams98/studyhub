import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from '../router'
import { ChevronRight as Sep, Check, ArrowLeft, ArrowRight, Eye } from 'lucide-react'
import { getCourse } from '../data'
import { cleanTitle, KIND_LABEL, annotateGlossaryTerms } from '../utils'
import { useProgress } from '../context/ProgressContext'
import CodeBlock from '../components/CodeBlock'
import Callout from '../components/Callout'
import Quiz from '../components/Quiz'
import MermaidDiagram from '../components/MermaidDiagram'

export default function LessonPage() {
  const { courseSlug, sectionSlug, lessonSlug } = useParams()
  const navigate = useNavigate()
  const course = getCourse(courseSlug)
  const { isComplete, toggleComplete } = useProgress()
  const [solutionRevealed, setSolutionRevealed] = useState(false)
  const { section, lesson } = course ? course.findLesson(sectionSlug, lessonSlug) : {}

  useEffect(() => {
    setSolutionRevealed(false)
  }, [lesson?.id])

  if (!course) {
    return (
      <main className="main">
        <div className="prose">
          <p>Course not found. <Link to="/">Back to all courses.</Link></p>
        </div>
      </main>
    )
  }

  if (!section || !lesson) {
    return (
      <main className="main">
        <div className="prose">
          <p>Couldn't find that lesson. <Link to={`/course/${courseSlug}`}>Back to the course overview.</Link></p>
        </div>
      </main>
    )
  }

  const { prev, next } = course.getAdjacentLessons(lesson.id)
  const progressKey = `${courseSlug}:${lesson.id}`
  const done = isComplete(progressKey)
  const title = cleanTitle(lesson.title)
  const isAssignment = lesson.kind === 'assignment'

  const goTo = (l) => l && navigate(`/course/${courseSlug}/${l.sectionSlug}/${l.slug}`)

  const annotate = (html) => annotateGlossaryTerms(html, course.glossary)

  const crossRefLessons = lesson.crossRefs
    ?.map((refId) => course.allLessons.find((l) => l.id === refId))
    .filter(Boolean)

  return (
    <main className="main">
      <div className="breadcrumb">
        <Link to={`/course/${courseSlug}`}>Curriculum</Link>
        <Sep size={11} className="sep" />
        <Link to={`/course/${courseSlug}/${section.sectionSlug}/${section.lessons[0]?.slug}`}>{section.title}</Link>
        <Sep size={11} className="sep" />
        <span>{lesson.id}</span>
      </div>

      <div className="badge-row">
        <span className="badge" style={{ background: `${section.color}26`, color: section.color }}>
          Section {section.id}
        </span>
        <span className="badge" style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
          Lesson {lesson.id}
        </span>
        {lesson.kind && KIND_LABEL[lesson.kind] && (
          <span className="badge" style={{ background: 'var(--bg-raised)', color: 'var(--text-mute)', border: '1px solid var(--border)' }}>
            {KIND_LABEL[lesson.kind]}
          </span>
        )}
        {section.optional && (
          <span className="badge" style={{ background: 'transparent', color: 'var(--text-mute)', border: '1px solid var(--border)' }}>
            Optional
          </span>
        )}
        <button className={`btn-complete${done ? ' done' : ''}`} onClick={() => toggleComplete(progressKey)}>
          <Check size={14} /> {done ? 'Completed' : 'Mark complete'}
        </button>
      </div>

      <h1 className="lesson-title">{title}</h1>
      <div className="lesson-meta">
        <span>{lesson.duration}</span>
        <span className="dot-sep" />
        <span>{section.title}</span>
      </div>

      {crossRefLessons?.length > 0 && (
        <div className="cross-refs">
          Builds on:{' '}
          {crossRefLessons.map((ref, i) => (
            <span key={ref.id}>
              {i > 0 && ', '}
              <Link to={`/course/${courseSlug}/${ref.sectionSlug}/${ref.slug}`}>
                Lesson {ref.id} — {cleanTitle(ref.title)}
              </Link>
            </span>
          ))}
        </div>
      )}

      <div className="divider" />

      <div className="content">
        <h2>What You Need to Know</h2>
        <div className="prose">
          {lesson.summary?.map((p, i) => <p key={i} dangerouslySetInnerHTML={{ __html: annotate(p) }} />)}
        </div>

        {lesson.diagram && (
          <div className="diagram-block" dangerouslySetInnerHTML={{ __html: lesson.diagram }} />
        )}
        {lesson.mermaid && <MermaidDiagram code={lesson.mermaid} />}

        {lesson.topics?.map((topic, i) => (
          <div key={i} className="topic-section">
            <h3 className="topic-title">{topic.title}</h3>
            <div className="prose">
              {topic.body?.map((p, j) => <p key={j} dangerouslySetInnerHTML={{ __html: annotate(p) }} />)}
            </div>
            {topic.diagram && (
              <div className="diagram-block" dangerouslySetInnerHTML={{ __html: topic.diagram }} />
            )}
            {topic.mermaid && <MermaidDiagram code={topic.mermaid} />}
            {topic.code && (
              <CodeBlock code={topic.code} label={topic.codeLabel || 'java'} />
            )}
          </div>
        ))}

        {lesson.keyPoints?.length > 0 && (
          <>
            <h2>Key Takeaways</h2>
            <ul className="key-points">
              {lesson.keyPoints.map((k, i) => <li key={i} dangerouslySetInnerHTML={{ __html: annotate(k) }} />)}
            </ul>
          </>
        )}

        {lesson.code && (
          <>
            <h2>Code Reference</h2>
            {isAssignment && !solutionRevealed ? (
              <button className="btn-outline btn-reveal-solution" onClick={() => setSolutionRevealed(true)}>
                <Eye size={14} /> Reveal solution
              </button>
            ) : (
              <CodeBlock code={lesson.code} label={lesson.codeLabel || `${lesson.id.replace('.', '')}.java`} />
            )}
          </>
        )}

        {lesson.note && <Callout label={lesson.note.label} text={lesson.note.text} tone={lesson.note.tone} />}

        {lesson.quiz && (
          <Quiz key={lesson.id} question={lesson.quiz.question} options={lesson.quiz.options} explanation={lesson.quiz.explanation} />
        )}
      </div>

      <div className="lesson-nav">
        {prev ? (
          <button className="nav-card" onClick={() => goTo(prev)} style={{ cursor: 'pointer', border: 'inherit' }}>
            <span className="nav-label"><ArrowLeft size={12} /> Previous</span>
            <span className="nav-title">{prev.id} — {cleanTitle(prev.title)}</span>
          </button>
        ) : <div className="nav-spacer" />}
        {next ? (
          <button className="nav-card next" onClick={() => goTo(next)} style={{ cursor: 'pointer', border: 'inherit' }}>
            <span className="nav-label">Next <ArrowRight size={12} /></span>
            <span className="nav-title">{next.id} — {cleanTitle(next.title)}</span>
          </button>
        ) : <div className="nav-spacer" />}
      </div>
    </main>
  )
}
