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

import { sectionMeta as springBatchSections } from './spring-batch-sections'
import { glossary as springBatchGlossary } from './spring-batch-glossary'
import springBatch01 from './spring-batch-lessons/section01.json'
import springBatch02 from './spring-batch-lessons/section02'
import springBatch03 from './spring-batch-lessons/section03.json'
import springBatch04 from './spring-batch-lessons/section04'
import springBatch11 from './spring-batch-lessons/section11'

import { sectionMeta as aiEngineeringSections } from './ai-engineering-sections'
import { glossary as aiEngineeringGlossary } from './ai-engineering-glossary'
import aiEngineering01 from './ai-engineering-lessons/section01'
import aiEngineering02 from './ai-engineering-lessons/section02'
import aiEngineering03 from './ai-engineering-lessons/section03'
import aiEngineering04 from './ai-engineering-lessons/section04'
import aiEngineering05 from './ai-engineering-lessons/section05'
import aiEngineering06 from './ai-engineering-lessons/section06'
import aiEngineering07 from './ai-engineering-lessons/section07'
import aiEngineering08 from './ai-engineering-lessons/section08'
import aiEngineering09 from './ai-engineering-lessons/section09'
import aiEngineering10 from './ai-engineering-lessons/section10'
import aiEngineering11 from './ai-engineering-lessons/section11'
import aiEngineering12 from './ai-engineering-lessons/section12'
import aiEngineering13 from './ai-engineering-lessons/section13'

import { sectionMeta as dockerSections } from './docker-sections'
import { glossary as dockerGlossary } from './docker-glossary'
import docker01 from './docker-lessons/section01'
import docker02 from './docker-lessons/section02'
import docker03 from './docker-lessons/section03'
import docker04 from './docker-lessons/section04'
import docker05 from './docker-lessons/section05'
import docker06 from './docker-lessons/section06'
import docker07 from './docker-lessons/section07'
import docker08 from './docker-lessons/section08'
import docker09 from './docker-lessons/section09'
import docker10 from './docker-lessons/section10'
import docker11 from './docker-lessons/section11'
import docker12 from './docker-lessons/section12'
import docker13 from './docker-lessons/section13'
import docker14 from './docker-lessons/section14'
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

const springBatchLessonsBySection = {
  1: springBatch01,
  2: springBatch02,
  3: springBatch03,
  4: springBatch04,
  11: springBatch11,
}

const dockerLessonsBySection = {
  1: docker01, 2: docker02, 3: docker03, 4: docker04, 5: docker05, 6: docker06, 7: docker07,
  8: docker08, 9: docker09, 10: docker10, 11: docker11, 12: docker12, 13: docker13, 14: docker14,
}

// Filled in section-by-section as lesson content is generated — see ADDING_COURSES.md.
const aiEngineeringLessonsBySection = {
  1: aiEngineering01, 2: aiEngineering02, 3: aiEngineering03, 4: aiEngineering04,
  5: aiEngineering05, 6: aiEngineering06, 7: aiEngineering07, 8: aiEngineering08,
  9: aiEngineering09, 10: aiEngineering10, 11: aiEngineering11, 12: aiEngineering12,
  13: aiEngineering13,
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
    slug: 'spring-batch',
    title: 'Spring Batch',
    subtitle: 'Field Guide',
    description:
      'Master Spring Batch from the core domain model to advanced partitioning and fault tolerance. ' +
      'Covering Job, Step, chunk processing, ItemReader/Writer/Processor, and production patterns.',
    color: '#E0A63A',
    tags: ['Java', 'Spring', 'Batch'],
    sectionMeta: springBatchSections,
    lessonsBySection: springBatchLessonsBySection,
    glossary: springBatchGlossary,
  },
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
  {
    slug: 'docker-kubernetes',
    title: 'Docker & Kubernetes',
    subtitle: 'Container Orchestration',
    description:
      'Go from "what is a container?" to running production workloads on Kubernetes. ' +
      'Covers Docker images, Dockerfiles, Compose, and volumes, then the full Kubernetes ' +
      'core — Pods, Deployments, Services, Ingress, Namespaces, ConfigMaps/Secrets, ' +
      'persistent storage, Helm, Operators, and monitoring with Prometheus.',
    color: '#2496ED',
    tags: ['DevOps', 'Docker', 'Kubernetes'],
    sectionMeta: dockerSections,
    lessonsBySection: dockerLessonsBySection,
    glossary: dockerGlossary,
  },
  {
    slug: 'ai-engineering',
    title: 'AI Engineering',
    subtitle: 'From Prompting to Production',
    description:
      'A roadmap.sh-based curriculum from prompt engineering and RAG through agents, ' +
      'fine-tuning, security, and production MLOps. Thirteen sections from Python/math ' +
      'foundations to a capstone production AI knowledge platform.',
    color: '#6E56CF',
    tags: ['AI', 'LLMs', 'MLOps'],
    sectionMeta: aiEngineeringSections,
    lessonsBySection: aiEngineeringLessonsBySection,
    glossary: aiEngineeringGlossary,
  },
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
