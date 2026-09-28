# Study Hub

A text-first study companion for technical video courses. Pick a course, work through sections and lessons at your own pace, check your understanding with inline quizzes, and look up terms in a per-course glossary — no video scrubbing required.

Built with React + Vite. All content is data-driven: courses, sections, lessons, and glossaries are plain JS/JSON modules under `src/data/`, rendered by a single shared set of pages and components.

## Courses included

| Course | Sections | Lessons | Notes |
| --- | --- | --- | --- |
| Project Reactor & Spring WebFlux | 13 | 174 | Reactive programming fundamentals — Mono, Flux, operators, schedulers, backpressure |
| Spring Batch | 5 | 41 | Core domain model through scaling batch jobs (work in progress — more sections planned) |
| Spring WebFlux | 13 | 175 | Reactive web APIs, R2DBC, functional endpoints, WebClient, streaming |
| Docker & Kubernetes | 14 | 75 | Containers and Dockerfiles through the full Kubernetes core, Helm, Operators, and monitoring |
| AI Engineering | 13 | 70 | Prompting, RAG, agents, fine-tuning, and production MLOps (work in progress — sections 7-13 planned) |

Each lesson includes a written explanation, key takeaways, runnable code/command/YAML snippets, a callout box for the most important point, and a self-check quiz.

## Beyond reading: run code and ask questions

Two features go past static text:

- **In-browser Python sandbox** — any Python-labeled code block (currently the AI Engineering course) becomes an editable, runnable snippet. Click Run and it executes for real in the browser via [Pyodide](https://pyodide.org) (CPython compiled to WebAssembly, loaded lazily from a CDN on first use — nothing is bundled into the build). NumPy and Matplotlib are auto-installed on first run, with rendered plots shown inline; packages with no browser-compatible build (e.g. PyTorch) fail with a short, readable message instead of a raw traceback.
- **"Ask about this lesson"** — a slide-out chat panel on every lesson, scoped to that lesson's own content, backed by an LLM. Answering it requires the small proxy server in [`server/`](server/) (see below) — without it, the panel shows a clear "not configured" message rather than failing silently.

### Running the Q&A proxy

The proxy keeps the model API key server-side; it's never shipped to the browser. It's a separate Node app with its own dependencies, meant to be deployed independently of the static site.

```bash
cd server
npm install
cp .env.example .env   # fill in API_KEY, MODEL, BASE_URL, and ALLOWED_ORIGINS
npm run dev
```

Then point the frontend at it by adding to the project-root `.env` (see `.env.example`):

```
VITE_PROXY_URL=http://localhost:8787
```

Rate limiting, request validation, and CORS restricted to `ALLOWED_ORIGINS` are built in — see [`server/index.js`](server/index.js).

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. To build a static production bundle:

```bash
npm run build
npm run preview
```

## Project structure

```
src/
  components/     Shared UI: CodeBlock, Sandbox, LessonChat, Callout, Quiz, Sidebar, etc.
  pages/          HomePage, CoursePage, LessonPage, GlossaryPage
  lib/            Framework-agnostic helpers: pyodideRuntime.js, lessonContext.js, chatHistoryDB.js
  data/
    courseRegistry.js   Registers every course (single source of truth)
    index.js             buildCourse() — turns section/lesson data into a navigable course
    <course>-sections.js   Section metadata (id, title, color) for a course
    <course>-lessons/      One file per section, each exporting an array of lesson objects
    <course>-glossary.js   Term/definition pairs for a course
server/           Standalone Express proxy for the lesson Q&A panel (own package.json, not part of the Vite build)
scripts/          Optional helpers for generating lesson data from video transcripts
```

## Adding a new course

See [ADDING_COURSES.md](ADDING_COURSES.md) for the full schema and a worked example. In short: create `<course>-sections.js`, `<course>-lessons/section01.js` … `sectionNN.js`, and `<course>-glossary.js`, then register the course in `src/data/courseRegistry.js`. No routing or component changes are needed — the site is fully data-driven.

`scripts/` contains optional Python/PowerShell helpers (`generate-from-transcripts.py`, `generate-from-curriculum.py`, `build-course.ps1`) that can call an LLM API (NVIDIA/Gemini/Ollama, via a `.env` file) to turn a raw transcript or curriculum outline into lesson data automatically — content can also be authored by hand directly in the target schema.

## Tech stack

- [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- [Pyodide](https://pyodide.org) for the in-browser Python sandbox (loaded from CDN at runtime, not bundled)
- [Express](https://expressjs.com/) for the standalone lesson Q&A proxy in `server/`
- [lucide-react](https://lucide.dev/) for icons
- [oxlint](https://oxc.rs/) for linting
- No CSS framework — hand-written styles in `src/App.css`
