import { Link, useParams } from '../router'
import { ChevronRight } from 'lucide-react'
import { getCourse } from '../data'

export default function GlossaryPage() {
  const { courseSlug } = useParams()
  const course = getCourse(courseSlug)

  if (!course || !course.glossary) {
    return (
      <main className="main">
        <p>Glossary not available. <Link to="/">Back to courses.</Link></p>
      </main>
    )
  }

  return (
    <main className="main">
      <div className="breadcrumb">
        <Link to={`/course/${courseSlug}`}>Curriculum</Link>
        <ChevronRight size={11} className="sep" />
        <span>Glossary</span>
      </div>
      <h1 className="lesson-title">Glossary</h1>
      <p className="lesson-meta" style={{ marginBottom: 30 }}>
        Quick reference for the key types and operators covered in {course.title}.
      </p>
      <div className="divider" />
      <div className="glossary-grid">
        {course.glossary.map((g) => (
          <div className="glossary-entry" key={g.term}>
            <h3>{g.term}</h3>
            <p>{g.def}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
