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
