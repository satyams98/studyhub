export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[\[\]]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function cleanTitle(t) {
  return t.replace(/^\[THEORY\]\s*/, '').replace(/^\*\*\*\s*|\s*\*\*\*$/g, '').trim()
}

export const KIND_LABEL = {
  theory: 'Theory',
  concept: 'Concept',
  demo: 'Hands-on',
  assignment: 'Assignment',
  solution: 'Solution',
  faq: 'FAQ',
  summary: 'Summary',
  setup: 'Setup',
}

// ─── Glossary hover tooltips ────────────────────────────────────────────────
// Wraps <em>/<code> spans whose inner text exactly matches a glossary term
// (case-insensitive) in a .gloss-term span carrying the definition, so CSS
// alone can render a hover tooltip. Terms with no glossary match are left as-is.

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function annotateGlossaryTerms(html, glossary) {
  if (!html || !glossary?.length) return html

  const defByTerm = new Map(glossary.map((g) => [g.term.toLowerCase(), g.def]))

  return html.replace(/<(em|code)>([^<]+)<\/\1>/g, (match, tag, inner) => {
    const def = defByTerm.get(inner.toLowerCase())
    if (!def) return match
    return `<${tag} class="gloss-term" data-def="${escapeAttr(def)}">${inner}</${tag}>`
  })
}

// ─── Course map diagram ─────────────────────────────────────────────────────
// Builds a Mermaid flowchart string from a course's sections: a sequential
// chain plus a bolder edge for every distinct section pair implied by a
// lesson's crossRefs (deduped). Degrades to a plain chain when no crossRefs exist.

export function buildCourseMapMermaid(course) {
  const sections = course.sections
  if (!sections?.length) return null

  const nodeId = (id) => `S${id}`
  const escapeLabel = (s) => s.replace(/"/g, "'")

  const lines = ['graph TD']
  sections.forEach((sec) => {
    lines.push(`  ${nodeId(sec.id)}["${sec.id}. ${escapeLabel(sec.title)}"]`)
  })

  for (let i = 0; i < sections.length - 1; i++) {
    lines.push(`  ${nodeId(sections[i].id)} --> ${nodeId(sections[i + 1].id)}`)
  }

  const sectionByLessonId = new Map()
  sections.forEach((sec) => sec.lessons.forEach((l) => sectionByLessonId.set(l.id, sec.id)))

  const crossEdges = new Set()
  course.allLessons.forEach((lesson) => {
    lesson.crossRefs?.forEach((refId) => {
      const fromSection = sectionByLessonId.get(refId)
      const toSection = sectionByLessonId.get(lesson.id)
      if (fromSection == null || toSection == null || fromSection === toSection) return
      const [a, b] = [fromSection, toSection].sort((x, y) => x - y)
      crossEdges.add(`${a}|${b}`)
    })
  })

  crossEdges.forEach((pair) => {
    const [a, b] = pair.split('|')
    lines.push(`  ${nodeId(a)} -.-> ${nodeId(b)}`)
  })

  return lines.join('\n')
}
