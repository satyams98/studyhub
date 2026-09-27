import { courses } from './data'
import { cleanTitle, KIND_LABEL } from './utils'

// ─── HTML stripping ──────────────────────────────────────────────────────
// Lesson/glossary text may contain a controlled set of inline tags
// (<code>, <strong>, <em>). A plain regex strip is sufficient — no need
// for a full HTML parser.
export function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, '')
}

// ─── Weighted scoring ────────────────────────────────────────────────────
// Tiers per field kind — how much a match in that field is worth. The
// corpus is short titles/terms plus full paragraphs, so plain weighted
// substring matching (rather than fuzzy/subsequence matching) keeps
// results explainable and snippets coherent.
const WEIGHTS = {
  title: { exact: 100, prefix: 80, substring: 60 },
  tag: { exact: 55, prefix: 50, substring: 45 },
  def: { exact: 45, prefix: 45, substring: 45 },
  keyPoint: { exact: 40, prefix: 40, substring: 40 },
  summary: { exact: 25, prefix: 25, substring: 25 },
  description: { exact: 15, prefix: 15, substring: 15 },
}

function fieldScore(text, query, kind) {
  if (!text) return 0
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query)
  if (idx === -1) return 0
  const tiers = WEIGHTS[kind] || WEIGHTS.summary
  if (lower === query) return tiers.exact
  if (idx === 0) return tiers.prefix
  return tiers.substring
}

// ─── Index construction (runs once, at module load) ─────────────────────
function buildSearchIndex(courseList) {
  const entries = []

  for (const course of courseList) {
    entries.push({
      type: 'course',
      id: `course:${course.slug}`,
      title: course.title,
      subtitle: course.subtitle || `${course.sections.length} sections`,
      courseSlug: course.slug,
      courseTitle: course.title,
      courseColor: course.color,
      navigateTo: `/course/${course.slug}`,
      matchFields: [
        { text: course.title, kind: 'title' },
        { text: course.subtitle || '', kind: 'title' },
        { text: course.description || '', kind: 'description' },
        ...(course.tags || []).map((t) => ({ text: t, kind: 'tag' })),
      ],
    })

    for (const lesson of course.allLessons) {
      const title = cleanTitle(lesson.title)
      entries.push({
        type: 'lesson',
        id: `lesson:${course.slug}:${lesson.id}`,
        title,
        subtitle: `${course.title} · ${KIND_LABEL[lesson.kind] || 'Lesson'}`,
        courseSlug: course.slug,
        courseTitle: course.title,
        courseColor: course.color,
        navigateTo: `/course/${course.slug}/${lesson.sectionSlug}/${lesson.slug}`,
        matchFields: [
          { text: title, kind: 'title' },
          ...(lesson.keyPoints || []).map((k) => ({ text: stripHtml(k), kind: 'keyPoint' })),
          ...(lesson.summary || []).map((s) => ({ text: stripHtml(s), kind: 'summary' })),
        ],
      })
    }

    for (const g of course.glossary || []) {
      entries.push({
        type: 'glossary',
        id: `glossary:${course.slug}:${g.term}`,
        title: g.term,
        subtitle: `${course.title} · Glossary`,
        courseSlug: course.slug,
        courseTitle: course.title,
        courseColor: course.color,
        navigateTo: `/course/${course.slug}/glossary`,
        matchFields: [
          { text: g.term, kind: 'title' },
          { text: stripHtml(g.def), kind: 'def' },
        ],
      })
    }
  }

  return entries
}

export const SEARCH_INDEX = buildSearchIndex(courses)

const CAPS = { course: 4, lesson: 6, glossary: 5 }

function scoreEntry(entry, query) {
  let best = 0
  let bestField = null
  for (const field of entry.matchFields) {
    const s = fieldScore(field.text, query, field.kind)
    if (s > best) {
      best = s
      bestField = field
    }
  }
  return { score: best, bestField }
}

function buildSnippet(text, query, maxLen = 96) {
  if (!text) return ''
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query)
  if (idx === -1) return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
  const start = Math.max(0, idx - 28)
  const end = Math.min(text.length, idx + query.length + 55)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = `…${snippet}`
  if (end < text.length) snippet = `${snippet}…`
  return snippet
}

// Splits `text` into { text, mark } parts around the first case-insensitive
// match of `query`, for <mark>-highlighting in the result list.
export function highlightSnippet(text, query) {
  if (!query || !text) return [{ text: text || '', mark: false }]
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query)
  if (idx === -1) return [{ text, mark: false }]
  const parts = []
  if (idx > 0) parts.push({ text: text.slice(0, idx), mark: false })
  parts.push({ text: text.slice(idx, idx + query.length), mark: true })
  if (idx + query.length < text.length) parts.push({ text: text.slice(idx + query.length), mark: false })
  return parts
}

// Returns { course: [], lesson: [], glossary: [] }, each ranked and capped.
// An empty query falls back to listing all courses (rather than a blank
// panel) instead of an arbitrary/noisy "everything" list.
export function search(rawQuery) {
  const query = (rawQuery || '').trim().toLowerCase()

  if (!query) {
    return {
      course: SEARCH_INDEX.filter((e) => e.type === 'course'),
      lesson: [],
      glossary: [],
    }
  }

  const scored = []
  for (const entry of SEARCH_INDEX) {
    const { score, bestField } = scoreEntry(entry, query)
    if (score > 0) scored.push({ entry, score, bestField })
  }
  scored.sort((a, b) => b.score - a.score)

  const grouped = { course: [], lesson: [], glossary: [] }
  for (const { entry, bestField } of scored) {
    const bucket = grouped[entry.type]
    if (bucket.length >= CAPS[entry.type]) continue
    const isTitleMatch = bestField ? bestField.kind === 'title' : false
    bucket.push({
      ...entry,
      snippet: bestField && !isTitleMatch ? buildSnippet(bestField.text, query) : '',
      snippetIsTitle: isTitleMatch,
    })
  }

  return grouped
}
