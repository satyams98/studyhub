# In-Browser Python Sandbox & Lesson Q&A Panel

Date: 2026-09-27

## Problem

The course site is text-first: learners read code but never run it. For the
code-heavy AI Engineering course (NumPy/PyTorch/FastAPI snippets), "read the
code" is a weak substitute for "run and mutate the code." Separately, there's
no way to ask a scoped follow-up question about what a lesson is teaching —
the site is a one-way read.

Two independent features address this:

1. **In-browser Python sandbox** — run and edit Python snippets directly on
   the lesson page.
2. **Lesson Q&A panel** — a per-lesson mini Socratic tutor backed by an LLM,
   scoped to that lesson's content.

## Constraints from the existing app

- The site builds to a single static HTML file (`vite-plugin-singlefile`) —
  there is no runtime backend today.
- The only existing LLM usage is at *build time*, via
  `scripts/generate-from-transcripts.py`, an OpenAI-compatible client against
  an NVIDIA-hosted endpoint configured through `.env` (`API_KEY`, `MODEL`,
  `BASE_URL`).
- The built site is shared/hosted for other learners, not just used locally.
  A runtime LLM feature therefore cannot embed the shared API key in the
  client bundle — anyone opening dev tools could extract and abuse it.
- Lesson data is plain JS objects (see `ADDING_COURSES.md`) with fields:
  `title`, `summary` (paragraphs), `keyPoints`, `code`/`codeLabel`, `note`,
  `quiz`, and per-topic `topics[]` (each with its own `body`/`code`).
  `codeLabel` is a free-form string used both as display label and, for
  Python snippets, is consistently `'python'` (see
  `src/data/ai-engineering-lessons/`).
- Only the AI Engineering course has Python content; other courses
  (WebFlux, Spring Batch, Docker/Kubernetes) are Java/YAML/Bash and are
  unaffected by either feature.

## Feature A: In-browser Python sandbox

### Scope

Applies wherever a code block's `codeLabel` (or a topic's `codeLabel`) is
exactly `'python'`. No new per-lesson data field is required — this covers
the AI Engineering course today and automatically covers any future
Python-labeled course content.

Not in scope: running Java, YAML, or terminal snippets; a real FastAPI HTTP
server (no real socket is available in-browser); running PyTorch (no
browser-compatible wheel exists for Pyodide).

### Runtime

[Pyodide](https://pyodide.org) (CPython compiled to WebAssembly), loaded from
its CDN (jsdelivr, version-pinned) via a dynamically injected `<script>` tag
at first use — not bundled by Vite. This keeps the single-file production
build unaffected in size; the ~10MB+ runtime and any packages are fetched
lazily, once, only when a learner clicks "Run" for the first time.

`src/lib/pyodideRuntime.js` exposes an async `getPyodide()` that:
- Injects the CDN script and calls `loadPyodide()` on first invocation.
- Caches the resulting interpreter instance in module scope so every
  subsequent Run click (on any lesson, in the same browser tab) reuses it.
- Lazily `micropip.install(['numpy', 'matplotlib'])` on first Python
  execution, also cached thereafter.

### UI

`CodeBlock.jsx` renders a `Sandbox` wrapper instead of the current read-only
`<pre>` when `label === 'python'`:

- The code renders in an editable, monospace `<textarea>` (visually
  consistent with the existing code block styling), pre-filled with the
  lesson's snippet. Learners can edit before running.
- A "Run" button (disabled + spinner while Pyodide is loading/installing on
  first use) executes the current (possibly edited) text via
  `pyodide.runPythonAsync`, with stdout/stderr redirected into buffers via
  `pyodide.setStdout`/`setStderr`.
- After execution, if `matplotlib.pyplot.get_fignums()` is non-empty, each
  open figure is exported via `savefig` to a base64 PNG and rendered in the
  output panel below the text output; figures are then closed.
- A "Reset" control restores the original snippet text.

### Output & error handling

- Successful runs show captured stdout, then any rendered plot images.
- Exceptions (including `ModuleNotFoundError` for packages Pyodide can't
  provide, e.g. `torch`) are caught and shown as a muted, human-readable
  message — "Couldn't run this in-browser: `<short reason>`" — never a raw
  Python traceback dump. Known-unsupported packages get a specific note
  (e.g. "PyTorch isn't available in the browser runtime").
- FastAPI snippets that only exercise request/response logic via
  `TestClient` run normally (no real networking needed); snippets that call
  `uvicorn.run(...)` will fail to bind a socket and surface the same
  friendly fallback message.

## Feature B: Lesson Q&A panel

### Server proxy (`server/`)

A new, standalone Express app — independent of the Vite frontend and of
`scripts/` — deployable on its own (Render/Railway/an internal host/etc.).

- `server/index.js` — single route `POST /api/ask`, body
  `{ lessonContext: string, question: string, history: [{role, content}] }`.
  Prepends a fixed system prompt instructing the model to answer only from
  `lessonContext` and say so if the question is unrelated, then forwards to
  the configured `BASE_URL` chat-completions endpoint using `MODEL` and
  `API_KEY`. Returns `{ answer }`. The API key is never sent to or readable
  by the client.
- Config via `server/.env` (mirrors the shape already used by the Python
  scripts): `API_KEY`, `MODEL`, `BASE_URL`, plus `PORT` and
  `ALLOWED_ORIGINS`.
- `express-rate-limit`, per IP, default 15 requests/minute (configurable via
  env), plus a body-size cap (~4KB question, ~20KB context) to bound cost
  and abuse against the shared free-tier key.
- CORS restricted to `ALLOWED_ORIGINS`.
- `server/package.json` is separate from the root `package.json` — this is
  a distinct deployable unit, not part of the Vite build.

### Frontend panel

- A toggle button near the lesson title/badges opens `LessonChat.jsx`, a
  slide-out panel using the same backdrop+panel visual pattern as
  `CommandPalette.jsx`.
- `src/lib/lessonContext.js` flattens a lesson object (title, summary
  paragraphs, keyPoints, code, note, and topic bodies/code) into a single
  text blob, truncated to a safe length, computed once when the panel opens
  for a given lesson.
- The panel calls `${import.meta.env.VITE_PROXY_URL}/api/ask` with the
  lesson context, the new question, and prior turns for this lesson.
- **History persistence:** each lesson's conversation is stored in
  IndexedDB (same approach as `ProgressContext.jsx`, a dedicated object
  store keyed by `${courseSlug}:${lesson.id}`), loaded when the panel opens
  and appended to as the conversation continues. Navigating to a different
  lesson swaps to (or starts) that lesson's own separately persisted
  history — nothing is cleared.
- `VITE_PROXY_URL` is a build-time env var pointing at wherever the proxy is
  deployed; documented in `.env.example`, left unset by default (the
  feature degrades to a clear "Q&A isn't configured for this build" message
  rather than failing silently).

### Error handling

Distinct inline messages in the panel for: proxy not configured (`VITE_PROXY_URL`
unset), network failure, and rate-limited (HTTP 429) responses.

## Out of scope

- Cross-lesson or whole-course Q&A (each conversation is scoped to one
  lesson's content).
- Authentication/accounts for the Q&A panel or the proxy.
- Running non-Python languages in the sandbox.
- Real network access from sandboxed Python code (e.g. an actual FastAPI
  server, or outbound HTTP calls).

## Testing / verification

- Sandbox: in the dev server preview, confirm a NumPy snippet runs and
  mutated edits re-run correctly; confirm a `torch`-importing snippet shows
  the friendly fallback instead of a raw traceback; confirm a matplotlib
  snippet renders an image in the output panel.
- Q&A panel: run the proxy locally, confirm a real question against a
  lesson returns a scoped answer, confirm the rate limit triggers after
  rapid repeated requests, and confirm history is restored correctly when
  revisiting a lesson.
