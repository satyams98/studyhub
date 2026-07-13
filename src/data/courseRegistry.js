// ─── Course Registry ───────────────────────────────────────────────────────
// Add new courses here. Each entry provides metadata shown on the homepage
// and a reference to the data module that exports { sections, glossary }.
//
// To add a new course:
//   1. Create lesson data files (see ADDING_COURSES.md)
//   2. Create a data module that exports sections + glossary
//   3. Add an entry here pointing to that module

import { buildCourse } from './index'
import { sectionMeta } from './sections'
import { glossary as reactorGlossary } from './glossary'
import l01 from './lessons/section01'
import l02 from './lessons/section02'
import l03 from './lessons/section03'
import l04 from './lessons/section04'
import l05 from './lessons/section05'
import l06 from './lessons/section06'
import l07 from './lessons/section07'
import l08 from './lessons/section08'
import l09 from './lessons/section09'
import l10 from './lessons/section10'
import l11 from './lessons/section11'
import l12 from './lessons/section12'
import l13 from './lessons/section13'

import { sectionMeta as webfluxSections } from './webflux-sections'
import { glossary as webfluxGlossary } from './webflux-glossary'
import webflux01 from './webflux-lessons/section01'
import webflux02 from './webflux-lessons/section02'
import webflux03 from './webflux-lessons/section03'
import webflux04 from './webflux-lessons/section04'
import webflux05 from './webflux-lessons/section05'
import webflux06 from './webflux-lessons/section06'
import webflux07 from './webflux-lessons/section07'
import webflux08 from './webflux-lessons/section08'
import webflux09 from './webflux-lessons/section09'
import webflux10 from './webflux-lessons/section10'
import webflux11 from './webflux-lessons/section11'
import webflux12 from './webflux-lessons/section12'
import webflux13 from './webflux-lessons/section13'
const webfluxLessonsBySection = {
  1: webflux01, 2: webflux02, 3: webflux03, 4: webflux04, 5: webflux05, 6: webflux06, 7: webflux07, 8: webflux08, 9: webflux09, 10: webflux10, 11: webflux11, 12: webflux12, 13: webflux13,
}


const reactorLessonsBySection = {
  1: l01, 2: l02, 3: l03, 4: l04, 5: l05, 6: l06,
  7: l07, 8: l08, 9: l09, 10: l10, 11: l11, 12: l12, 13: l13,
}

// ─── Registry ──────────────────────────────────────────────────────────────
const courseDefs = [
  {
    slug: 'reactor',
    title: 'Project Reactor & Spring WebFlux',
    subtitle: 'Reactive Programming Field Guide',
    description:
      'Master reactive programming from OS-level non-blocking I/O to Sinks and Context. ' +
      'Thirteen sections covering Mono, Flux, operators, schedulers, backpressure, and more.',
    color: '#C96442',
    tags: ['Java', 'Spring', 'Reactive'],
    sectionMeta,
    lessonsBySection: reactorLessonsBySection,
    glossary: reactorGlossary,
  },
  // ── Add more courses below ────────────────────────────────────────────
  {
    slug: 'webflux',
    title: 'Spring WebFlux',
    subtitle: 'Study Guide',
    description: 'Study content generated from course transcripts.',
    color: '#5B8DEF',
    tags: ['Java', 'Spring', 'WebFlux'],
    sectionMeta: webfluxSections,
    lessonsBySection: webfluxLessonsBySection,
    glossary: webfluxGlossary,
  },
  // {
  //   slug: 'docker-kubernetes',
  //   title: 'Docker & Kubernetes',
  //   subtitle: 'Container Orchestration',
  //   description: 'Learn containerization and orchestration from scratch.',
  //   color: '#5B8DEF',
  //   tags: ['DevOps', 'Docker', 'K8s'],
  //   sectionMeta: dockerSections,
  //   lessonsBySection: dockerLessons,
  //   glossary: dockerGlossary,
  // },
]

// ─── Build & Export ────────────────────────────────────────────────────────
export const courses = courseDefs.map((def) => {
  const built = buildCourse(def.sectionMeta, def.lessonsBySection)
  return {
    slug: def.slug,
    title: def.title,
    subtitle: def.subtitle,
    description: def.description,
    color: def.color,
    tags: def.tags,
    glossary: def.glossary,
    ...built,
  }
})

export const courseMap = Object.fromEntries(courses.map((c) => [c.slug, c]))

export function getCourse(slug) {
  return courseMap[slug] || null
}
