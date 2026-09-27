import { cleanTitle } from '../utils'

const MAX_CONTEXT_LENGTH = 8000

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '')
}

export function buildLessonContext(lesson) {
  const parts = [`Lesson: ${cleanTitle(lesson.title)}`]

  if (lesson.summary?.length) {
    parts.push('\nSummary:\n' + lesson.summary.map(stripHtml).join('\n\n'))
  }
  if (lesson.keyPoints?.length) {
    parts.push('\nKey points:\n' + lesson.keyPoints.map((k) => `- ${stripHtml(k)}`).join('\n'))
  }
  if (lesson.code) {
    parts.push(`\nCode reference (${lesson.codeLabel || 'code'}):\n${lesson.code}`)
  }
  if (lesson.note?.text) {
    parts.push(`\n${lesson.note.label || 'Note'}: ${stripHtml(lesson.note.text)}`)
  }
  for (const topic of lesson.topics || []) {
    parts.push(`\nTopic: ${topic.title}`)
    if (topic.body?.length) parts.push(topic.body.map(stripHtml).join('\n\n'))
    if (topic.code) parts.push(`Code:\n${topic.code}`)
  }

  const context = parts.join('\n')
  return context.length > MAX_CONTEXT_LENGTH
    ? context.slice(0, MAX_CONTEXT_LENGTH) + '\n…(truncated)'
    : context
}
