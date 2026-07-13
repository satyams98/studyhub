import { slugify, cleanTitle } from '../utils'

// ─── Generic course builder ─────────────────────────────────────────────────
// Takes section metadata + a map of lesson arrays, returns the same structure
// previously hard-coded for the reactor course. Re-used by courseRegistry.js
// to build every registered course.

export function buildCourse(sectionMeta, lessonsBySection) {
  const sections = sectionMeta.map((sec) => {
    const sectionSlug = `${sec.id}-${slugify(sec.title)}`
    const lessons = (lessonsBySection[sec.id] || []).map((lesson) => ({
      ...lesson,
      sectionId: sec.id,
      sectionSlug,
      slug: `${lesson.id.replace('.', '-')}-${slugify(cleanTitle(lesson.title))}`,
    }))
    return { ...sec, sectionSlug, lessons }
  })

  const allLessons = sections.flatMap((s) => s.lessons)

  function findSection(sectionSlug) {
    return sections.find((s) => s.sectionSlug === sectionSlug)
  }

  function findLesson(sectionSlug, lessonSlug) {
    const section = findSection(sectionSlug)
    if (!section) return { section: null, lesson: null }
    const lesson = section.lessons.find((l) => l.slug === lessonSlug)
    return { section, lesson }
  }

  function getAdjacentLessons(lessonId) {
    const idx = allLessons.findIndex((l) => l.id === lessonId)
    return {
      prev: idx > 0 ? allLessons[idx - 1] : null,
      next: idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null,
    }
  }

  return { sections, allLessons, totalLessons: allLessons.length, findSection, findLesson, getAdjacentLessons }
}

// ─── Re-exports from the course registry ─────────────────────────────────
export { courses, courseMap, getCourse } from './courseRegistry'
