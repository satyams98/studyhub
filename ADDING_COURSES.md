# Adding a New Course

This guide explains how to add a new course to the Study Hub from a Udemy (or similar) video course transcript.

---

## 1. Prepare Your Transcript

You need a raw text transcript of the video course. Most Udemy courses provide downloadable subtitles (`.srt` or `.vtt`), or you can copy text from auto-generated captions.

**Recommended approach:** Use an LLM (Claude, ChatGPT, etc.) to process the transcript into structured lesson data. See [Step 3](#3-generate-lesson-data-with-an-llm) for the prompt.

---

## 2. Create the Data Files

All data for a new course lives in `src/data/`. You need three things:

### a) Section metadata — `src/data/<course>-sections.js`

```js
// Example: src/data/docker-sections.js
export const sectionMeta = [
  { id: 1,  title: 'Introduction to Containers',     optional: false, color: '#5B8DEF' },
  { id: 2,  title: 'Docker Images & Dockerfiles',    optional: false, color: '#3FB68B' },
  { id: 3,  title: 'Docker Compose',                 optional: false, color: '#C96442' },
  { id: 4,  title: 'Networking',                     optional: true,  color: '#B57BEE' },
  // ...
]
```

Each section needs:
| Field      | Type    | Description                                         |
| ---------- | ------- | --------------------------------------------------- |
| `id`       | number  | Sequential section number (1, 2, 3...)              |
| `title`    | string  | Section title                                       |
| `optional` | boolean | Whether the section is optional/bonus content       |
| `color`    | string  | Hex color for the sidebar dot & progress indicators |

**Color palette suggestion** (cycle through these):
`#5B8DEF`, `#3FB68B`, `#C96442`, `#B57BEE`, `#E0A63A`, `#E1596B`

### b) Lesson files — `src/data/<course>-lessons/section01.js`, etc.

Each section gets its own file exporting an array of lesson objects:

```js
// Example: src/data/docker-lessons/section01.js
export default [
  {
    id: '1.1',
    title: 'What Are Containers?',
    duration: '5 min',
    kind: 'theory',       // theory | concept | demo | assignment | solution | faq | summary | setup
    summary: [
      'First paragraph of the lesson content...',
      'Second paragraph...',
    ],
    keyPoints: [
      'A container is an isolated process with its own filesystem.',
      'Containers share the host OS kernel — unlike VMs.',
      '<strong>Docker</strong> is the most popular container runtime.',
    ],
    code: `// Optional code snippet
docker run -d -p 8080:80 nginx`,
    codeLabel: 'terminal',  // Optional — label shown above the code block
    note: {                  // Optional — callout box at the end
      label: 'WHY THIS MATTERS',
      text: 'Understanding containers is foundational to modern deployment.',
      tone: 'accent',       // 'accent' (default orange) or 'green'
    },
    mermaid: `graph TD
      A[Input] --> B[Model]
      B --> C[Output]`,     // Optional — real Mermaid syntax, rendered client-side
    crossRefs: ['1.2'],      // Optional — lesson IDs this lesson builds on; rendered as links
  },
  {
    id: '1.2',
    title: 'Installing Docker',
    duration: '3 min',
    kind: 'setup',
    summary: ['Install Docker Desktop on your machine...'],
    keyPoints: ['Verify with `docker --version`'],
  },
]
```

**Lesson object fields:**

| Field       | Required | Type     | Description                                              |
| ----------- | -------- | -------- | -------------------------------------------------------- |
| `id`        | Yes      | string   | `"sectionNum.lessonNum"` e.g. `"3.2"`                   |
| `title`     | Yes      | string   | Lesson title. Prefix with `[THEORY]` for theory labels   |
| `duration`  | Yes      | string   | Estimated reading time e.g. `"5 min"`                    |
| `kind`      | No       | string   | One of: theory, concept, demo, assignment, solution, faq, summary, setup |
| `summary`   | Yes      | string[] | Array of paragraphs (the main lesson content)            |
| `keyPoints` | No       | string[] | Bullet points (supports inline HTML like `<strong>`)     |
| `code`      | No       | string   | Code snippet to display. For `kind: 'assignment'`, this is the reference solution — hidden behind a "Reveal solution" toggle until clicked |
| `codeLabel` | No       | string   | Label for the code block header                          |
| `note`      | No       | object   | `{ label, text, tone }` callout box                      |
| `diagram`   | No       | string   | Raw HTML for a hand-built diagram (custom CSS classes), injected as-is |
| `mermaid`   | No       | string   | Mermaid diagram syntax, rendered to SVG. Separate from `diagram` — use this for anything structural (flows, architectures, pipelines) |
| `crossRefs` | No       | string[] | Lesson IDs this lesson builds on, e.g. `['6.2', '6.3']`. Rendered as clickable "Builds on: Lesson 6.2, …" links |

**Glossary tooltips are automatic, no extra field needed:** any `<em>` or `<code>` term in `summary`/`keyPoints`/topic bodies whose inner text exactly matches a glossary `term` (case-insensitive) gets a hover tooltip with that definition. Keep wording/casing consistent between prose and the glossary file.

### c) Glossary — `src/data/<course>-glossary.js`

```js
// Example: src/data/docker-glossary.js
export const glossary = [
  { term: 'Container', def: 'An isolated process running with its own filesystem, built from an image.' },
  { term: 'Image', def: 'A read-only template with instructions for creating a container.' },
  // ...
]
```

---

## 3. Generate Lesson Data with an LLM

Feed the transcript to an LLM with this prompt (adapt as needed):

```
I have a transcript from a video course. Convert it into structured lesson data
for a study guide website.

For each logical lesson segment, produce a JavaScript object with:
- id: "sectionNum.lessonNum" (e.g., "2.3")
- title: A descriptive lesson title
- duration: Estimated reading time (e.g., "5 min")
- kind: One of: theory, concept, demo, assignment, solution, faq, summary, setup
- summary: Array of paragraphs capturing the key content (be thorough — this
  replaces watching the video)
- keyPoints: Array of concise bullet points summarizing takeaways
  (supports <strong>, <code> HTML tags)
- code: (if applicable) Code snippet shown in the lesson
- codeLabel: Label for the code block
- note: { label: "WHY THIS MATTERS", text: "...", tone: "accent" }
  (optional callout for important context)

Guidelines:
- Write in a direct, practical tone. No filler. Explain *why*, not just *what*.
- Include enough detail that someone can learn without watching the video.
- Group related content into logical lessons of 3-7 min reading time.
- Use the same section numbering as the course structure.

Export as: export default [ { ... }, { ... } ]

Here is the transcript for Section N:
<paste transcript>
```

**Tip:** Process one section at a time. After generating all sections, also ask the LLM to produce the section metadata and glossary files.

---

## 4. Register the Course

Open `src/data/courseRegistry.js` and add your course:

```js
// 1. Add imports for your new course data
import { sectionMeta as dockerSections } from './docker-sections'
import { glossary as dockerGlossary } from './docker-glossary'
import d01 from './docker-lessons/section01'
import d02 from './docker-lessons/section02'
import d03 from './docker-lessons/section03'
// ... import all section lesson files

const dockerLessonsBySection = {
  1: d01, 2: d02, 3: d03,
}

// 2. Add entry to the courseDefs array
const courseDefs = [
  // ... existing courses ...
  {
    slug: 'docker',                          // URL-safe identifier
    title: 'Docker & Kubernetes',            // Full course title
    subtitle: 'Container Orchestration',     // Short subtitle (shown in nav)
    description: 'Learn containerization...', // 1-2 sentence description
    color: '#5B8DEF',                        // Primary course accent color
    tags: ['DevOps', 'Docker', 'K8s'],       // Tags shown on course card
    sectionMeta: dockerSections,
    lessonsBySection: dockerLessonsBySection,
    glossary: dockerGlossary,
  },
]
```

That's it! The course will automatically appear on the homepage and be fully navigable.

---

## 5. File Structure Summary

After adding a "Docker" course, your data folder looks like:

```
src/data/
  courseRegistry.js        ← Course registry (add entry here)
  sections.js              ← Reactor section metadata
  glossary.js              ← Reactor glossary
  lessons/                 ← Reactor lessons
    section01.js ... section13.js
  docker-sections.js       ← Docker section metadata
  docker-glossary.js       ← Docker glossary  
  docker-lessons/          ← Docker lessons
    section01.js
    section02.js
    section03.js
  index.js                 ← buildCourse helper (don't modify)
```

---

## 6. Checklist

- [ ] Section metadata file created with IDs, titles, colors
- [ ] Lesson files created (one per section), each exporting an array
- [ ] Glossary file created with key terms
- [ ] Imports added to `courseRegistry.js`
- [ ] `lessonsBySection` map created
- [ ] Entry added to `courseDefs` array with slug, title, subtitle, description, color, tags
- [ ] Run `npm run dev` and verify the course appears on the homepage
- [ ] Click through sections and lessons to verify navigation
- [ ] Check glossary page renders correctly
