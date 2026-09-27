# AI Engineering Course + Platform Enhancements — Design

Date: 2026-09-27

## Context

The app (`reactor-course`, a Vite + React "Study Hub") currently hosts four courses
(Reactor/WebFlux, Spring Batch, WebFlux study guide, Docker & Kubernetes), each
following the same pattern documented in `ADDING_COURSES.md`: a `sectionMeta`
array, a `<course>-lessons/sectionNN.js` file per section, a `glossary.js`, and
a registry entry in `src/data/courseRegistry.js`.

A new "AI Engineering" course (13 sections, ~70 lessons, roadmap from
roadmap.sh/ai/roadmap/ai-engineering-if4uf) is being generated in a separate
Claude chat session and will be pasted in section-by-section over time. This
spec covers preparing the app to receive that content, plus a set of learning
features identified while planning the course.

Two ambitious features from that planning discussion — an in-browser Pyodide
code sandbox, and a per-lesson LLM tutor panel — are explicitly **out of
scope** for this spec. Both need their own architecture decisions (Pyodide
package/runtime constraints; API-key/backend handling for the tutor) and will
get their own brainstorming pass later, once the course has real content to
build against.

## Goals

1. Register an (initially empty) "AI Engineering" course so pasted section
   content can be wired in incrementally.
2. Add real Mermaid diagram rendering (the app currently has none — the
   existing `diagram` field is hand-built HTML, not Mermaid, and must stay
   working unchanged).
3. Add four learning features, all **generic** (apply to every course, not
   just AI Engineering): reveal-toggle for lab solutions, clickable
   cross-references, glossary hover tooltips, and a course-map diagram.

## Non-goals

- Pyodide sandbox, LLM tutor panel (deferred).
- Spaced-repetition queue, section gates, confidence self-rating (deferred —
  user chose not to build these this round).
- Touching the existing `diagram` field/rendering path (used by Spring Batch
  today) or any in-progress uncommitted Docker course content rewrite.
- Generating any actual AI Engineering lesson content (arrives via paste).

## Design

### 1. Mermaid rendering

- Add dependency: `mermaid` (npm).
- New component `src/components/MermaidDiagram.jsx`:
  - Props: `{ code }` (a Mermaid syntax string).
  - Renders client-side via `mermaid.render(id, code)` inside a `useEffect`
    keyed on `code` and the current theme.
  - Reads `useTheme()` and passes `theme: 'dark' | 'default'` into
    `mermaid.initialize`.
  - Wraps the render call in try/catch; on failure, renders a small inline
    error message (`<div class="mermaid-error">Diagram error: …</div>`)
    instead of throwing, so one bad diagram can't crash a lesson page.
  - Output SVG is injected via a ref + `innerHTML` (Mermaid returns an SVG
    string), not `dangerouslySetInnerHTML` on the component itself, to keep
    the render lifecycle explicit.
- Schema: new optional lesson/topic field `mermaid` (string, Mermaid syntax).
  This is **separate** from the existing `diagram` field (raw HTML/CSS,
  unchanged) — both can be present on the same lesson.
- `LessonPage.jsx`: render `<MermaidDiagram code={lesson.mermaid} />` next to
  the existing `lesson.diagram` block, and same for `topic.mermaid` inside the
  topics loop.

### 2. Assignment reveal-solution toggle

- `LessonPage.jsx`: when `lesson.kind === 'assignment'` and `lesson.code` is
  present, wrap the existing "Code Reference" heading + `CodeBlock` in a
  toggle:
  - Local `useState(false)` per lesson (key includes `lesson.id` so it resets
    on navigation).
  - Collapsed state shows a "Reveal solution" button.
  - Expanded state shows the heading + code block as today.
- No change for any other `kind` value — solution/demo/etc. lessons render
  exactly as before.

### 3. Clickable cross-references

- New optional lesson field `crossRefs: string[]`, each entry a lesson `id`
  (e.g. `'6.2'`) this lesson builds on.
- `buildCourse` (`src/data/index.js`) needs no changes — `crossRefs` passes
  through via the existing lesson spread.
- `LessonPage.jsx`: below the lesson meta row, if `lesson.crossRefs?.length`,
  render "Builds on: " followed by a link per ref. Resolve each ref via
  `course.allLessons.find(l => l.id === ref)` to get `sectionSlug` + `slug`
  for the `Link` target. Refs that don't resolve (typo, wrong course) are
  silently skipped rather than rendering a broken link.

### 4. Glossary hover tooltips

- New util `src/utils/glossaryTooltip.js`:
  - `annotateGlossaryTerms(html, glossary)`.
  - Regex matches `<em>([^<]+)</em>` and `<code>([^<]+)</code>` spans.
  - For each match, look up the inner text against `glossary` (case-insensitive
    exact match on `term`).
  - On a hit, replace the tag with
    `<TAG class="gloss-term" data-def="ESCAPED_DEF">INNER</TAG>` — attribute
    value HTML-escaped (quotes/ampersands) so definitions containing quotes
    don't break the markup.
  - No match → left untouched.
- Applied in `LessonPage.jsx` wherever lesson/topic HTML strings are injected
  (summary paragraphs, keyPoints, topic bodies), passing `course.glossary`.
  Skipped entirely if `course.glossary` is empty/absent.
- CSS (`App.css`): `.gloss-term` gets a dotted underline; `:hover`/`:focus`
  reveals a `::after` tooltip bubble whose `content` is `attr(data-def)`,
  positioned absolutely above the term, theme-aware colors, capped
  `max-width` so long definitions wrap instead of overflowing.

### 5. Course-map diagram

- `CoursePage.jsx`, new section titled "Course Map" placed after the hero
  stats/progress bar and before the "Curriculum" section list. Only rendered
  when `course.sections.length > 1`.
- Graph built by a small helper (co-located in CoursePage or a new
  `src/utils/courseMap.js`) from data already on `course`:
  - One Mermaid node per section: `S{id}["{id}. {title}"]`.
  - A thin sequential edge `S{n} --> S{n+1}` for every consecutive section
    pair (the default "read in order" path).
  - A bolder/styled edge for every distinct section-pair implied by a
    lesson's `crossRefs` pointing into an earlier section (deduped — one edge
    per pair, not per lesson).
  - Rendered via the same `MermaidDiagram` component. Read-only in v1 — no
    click-to-navigate (Mermaid click callbacks add complexity not justified
    yet).
  - Courses with no `crossRefs` data at all (every course today) simply show
    the sequential chain — a reasonable default, not a broken/empty state.

### 6. AI Engineering course scaffolding

Following the existing `ADDING_COURSES.md` pattern exactly:

- `src/data/ai-engineering-sections.js` — exports `sectionMeta = []`.
- `src/data/ai-engineering-lessons/` — created empty; section files added as
  content is pasted.
- `src/data/ai-engineering-glossary.js` — exports `glossary = []`.
- `src/data/courseRegistry.js` — new entry:
  ```js
  {
    slug: 'ai-engineering',
    title: 'AI Engineering',
    subtitle: 'From Prompting to Production',
    description: 'A roadmap.sh-based curriculum from prompt engineering ' +
      'and RAG through agents, fine-tuning, security, and production MLOps.',
    color: '#6E56CF',
    tags: ['AI', 'LLMs', 'MLOps'],
    sectionMeta: aiEngineeringSections,
    lessonsBySection: {},
    glossary: aiEngineeringGlossary,
  }
  ```
- Course appears on the homepage immediately with 0 sections/lessons; each
  pasted section adds a lesson file + an import + a `lessonsBySection` map
  entry + a `sectionMeta` row.

### Documentation

- `ADDING_COURSES.md` updated: document `mermaid`, `crossRefs`, and the
  `<em>`/`<code>`-for-tooltips convention in the lesson fields table, so
  future course content (including the AI Engineering generation prompts)
  targets the right schema.

## Testing / verification

- `npm run dev`, visually confirm:
  - Existing courses (Spring Batch `diagram` field, Docker, Reactor,
    WebFlux) render unchanged.
  - A test Mermaid diagram renders correctly in both light and dark theme.
  - A malformed Mermaid string shows the inline error, not a crash.
  - An assignment-kind lesson (temporarily authored in one existing course
    for testing, or verified once real AI Engineering content lands) shows
    the reveal toggle.
  - crossRefs render as working links.
  - Glossary tooltip shows on hover over a matching `<em>`/`<code>` term.
  - Course-map renders for a course with 2+ sections (sequential chain, since
    no course has crossRefs data yet).
  - AI Engineering course card appears on the homepage.
