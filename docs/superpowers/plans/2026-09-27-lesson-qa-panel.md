# Lesson Q&A Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let learners ask a question about the lesson they're currently reading and get an answer scoped to that lesson's content, without ever exposing the shared NVIDIA/GLM API key to the browser.

**Architecture:** A new, standalone Express proxy (`server/`) holds the API key server-side and exposes `POST /api/ask`, rate-limited per IP. The frontend adds a slide-out chat panel (`LessonChat`) on the lesson page that flattens the current lesson's data into a text context, calls the proxy, and persists each lesson's conversation in IndexedDB.

**Tech Stack:** Express, cors, express-rate-limit, dotenv (new, in `server/` only — not added to the root `package.json`), React (existing), IndexedDB (browser-native, no library).

## Global Constraints

- This repo has no automated test framework (verified via `package.json` and a repo-wide search — none exist), and the approved spec (`docs/superpowers/specs/2026-09-27-sandbox-and-lesson-qa-design.md`) explicitly calls for manual verification for this feature. Every task below is verified by hand (curl for the server, the browser preview for the frontend), not by an automated test suite. Do not introduce a test framework as part of this plan — out of scope.
- The API key must never be sent to, or readable by, the browser. It only ever lives in `server/.env`, read by `server/index.js`.
- `server/` is a standalone Node application with its own `package.json` and dependencies — it is not part of the Vite build and is deployed separately from the static site.
- Rate limiting is required on `POST /api/ask` (per the approved spec) to protect the shared free-tier key from casual abuse once the site is public.
- The Q&A panel must degrade to a clear, visible message (not a silent failure or a crash) in every failure case: proxy not configured, network failure, rate-limited (429), and upstream API error.
- The panel is available on every lesson in every course (it is not restricted to the AI Engineering course — unlike the Python sandbox in the companion plan).

---

### Task 1: Q&A proxy server

**Files:**
- Create: `server/package.json`
- Create: `server/.env.example`
- Create: `server/index.js`

**Interfaces:**
- Produces: an HTTP endpoint `POST /api/ask` accepting JSON body `{ lessonContext: string, question: string, history: [{role: 'user'|'assistant', content: string}] }` and returning `{ answer: string }` on success (200), `{ error: string }` on validation failure (400), rate limit (429, with a `Retry-After` header via `standardHeaders`), or upstream failure (502). Later tasks (Task 3) depend on this exact request/response shape.

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "reactor-course-qa-proxy",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.4.0"
  }
}
```

- [ ] **Step 2: Create `server/.env.example`**

```
# NVIDIA/OpenAI-compatible endpoint config — same values as the project-root
# .env used by scripts/generate-from-transcripts.py.
API_KEY=
MODEL=
BASE_URL=

# Port this proxy listens on.
PORT=8787

# Comma-separated list of origins allowed to call this proxy — e.g. the
# deployed site's origin(s) and http://localhost:5173 for local dev.
ALLOWED_ORIGINS=http://localhost:5173

# Requests per minute allowed per IP address.
RATE_LIMIT_PER_MINUTE=15
```

- [ ] **Step 3: Create `server/index.js`**

```js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'

const PORT = process.env.PORT || 8787
const API_KEY = process.env.API_KEY
const MODEL = process.env.MODEL
const BASE_URL = process.env.BASE_URL
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 15)

if (!API_KEY || !MODEL || !BASE_URL) {
  console.error('Missing required env vars: API_KEY, MODEL, BASE_URL — see server/.env.example')
  process.exit(1)
}

const CHAT_COMPLETIONS_URL = `${BASE_URL.replace(/\/+$/, '')}/chat/completions`

const SYSTEM_PROMPT_PREFIX = `You are a study tutor answering questions about ONE specific lesson from a course. Answer ONLY using the lesson content provided below. If the learner's question is unrelated to this lesson's content, say so briefly instead of guessing. Be concise and direct.

LESSON CONTENT:
`

const app = express()
app.use(express.json({ limit: '32kb' }))
app.use(cors({ origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false }))

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
})
app.use('/api/ask', limiter)

app.post('/api/ask', async (req, res) => {
  const { lessonContext, question, history } = req.body || {}

  if (typeof lessonContext !== 'string' || lessonContext.length === 0 || lessonContext.length > 20000) {
    return res.status(400).json({ error: 'lessonContext must be a non-empty string up to 20000 characters.' })
  }
  if (typeof question !== 'string' || question.length === 0 || question.length > 4000) {
    return res.status(400).json({ error: 'question must be a non-empty string up to 4000 characters.' })
  }

  const safeHistory = Array.isArray(history)
    ? history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-10)
    : []

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT_PREFIX + lessonContext },
    ...safeHistory,
    { role: 'user', content: question },
  ]

  try {
    const upstream = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 800,
        stream: false,
      }),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      console.error('Upstream error', upstream.status, text)
      return res.status(502).json({ error: 'The model API returned an error.' })
    }

    const data = await upstream.json()
    const answer = data?.choices?.[0]?.message?.content
    if (!answer) {
      return res.status(502).json({ error: 'The model API returned an empty response.' })
    }
    return res.json({ answer })
  } catch (err) {
    console.error('Proxy request failed', err)
    return res.status(502).json({ error: 'Failed to reach the model API.' })
  }
})

app.listen(PORT, () => {
  console.log(`Lesson Q&A proxy listening on port ${PORT}`)
})
```

- [ ] **Step 4: Install dependencies and configure**

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env` and fill in `API_KEY`, `MODEL`, and `BASE_URL` with the same values already present in the project-root `.env` (used by `scripts/generate-from-transcripts.py`). Leave `PORT`, `ALLOWED_ORIGINS`, and `RATE_LIMIT_PER_MINUTE` at their `.env.example` defaults for now.

- [ ] **Step 5: Verify manually with curl**

Start the server:

```bash
npm run dev
```

Expected terminal output: `Lesson Q&A proxy listening on port 8787`.

In a second terminal, send a valid request:

```bash
curl -s -X POST http://localhost:8787/api/ask \
  -H "Content-Type: application/json" \
  -d '{"lessonContext":"Lesson: Test.\nSummary: NumPy arrays support vectorized operations instead of manual Python loops for elementwise math.","question":"What does this lesson say about loops?","history":[]}'
```

Expected: HTTP 200 with a JSON body `{"answer": "..."}` whose text references vectorized operations / not needing manual loops (i.e. it used the supplied context, not general knowledge).

Test validation — missing `lessonContext`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8787/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"hi"}'
```

Expected: `400`

Test the rate limit without burning 15+ real API calls: stop the server, temporarily set `RATE_LIMIT_PER_MINUTE=3` in `server/.env`, restart (`npm run dev`), then:

```bash
for i in 1 2 3 4; do
  curl -s -o /dev/null -w "request $i -> %{http_code}\n" -X POST http://localhost:8787/api/ask \
    -H "Content-Type: application/json" \
    -d '{"lessonContext":"x","question":"hi","history":[]}'
done
```

Expected: requests 1–3 print `200`, request 4 prints `429`. Afterward, set `RATE_LIMIT_PER_MINUTE` back to `15` in `server/.env` and restart the server (leave it running for Task 3's verification).

- [ ] **Step 6: Commit**

The root `.gitignore` already ignores any path segment named `.env` and any `node_modules` directory at any depth, so `server/.env` and `server/node_modules/` are already excluded.

```bash
git add server/package.json server/package-lock.json server/.env.example server/index.js
git commit -m "Add Q&A proxy server that keeps the model API key off the client"
```

---

### Task 2: Lesson context flattening and chat history persistence

**Files:**
- Create: `src/lib/lessonContext.js`
- Create: `src/lib/chatHistoryDB.js`

**Interfaces:**
- Consumes: `cleanTitle` from `src/utils.js` (existing).
- Produces: `export function buildLessonContext(lesson): string` and `export async function loadChatHistory(key: string): Promise<Array<{role, content}>>` / `export async function saveChatHistory(key: string, messages: Array<{role, content}>): Promise<void>` — all three are consumed by Task 3's `LessonChat.jsx`.

- [ ] **Step 1: Create `src/lib/lessonContext.js`**

```js
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
```

- [ ] **Step 2: Create `src/lib/chatHistoryDB.js`**

```js
// Per-lesson chat history, persisted in IndexedDB — same approach as
// src/context/ProgressContext.jsx, but keyed by "<courseSlug>:<lessonId>"
// and storing an array of {role, content} messages instead of a boolean.

const DB_NAME = 'study-hub-chat'
const DB_VERSION = 1
const STORE_NAME = 'lessonChats'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadChatHistory(key) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

export async function saveChatHistory(key, messages) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(messages, key)
  } catch {
    // best-effort persistence — a lost write just means history isn't restored later
  }
}
```

- [ ] **Step 3: Verify manually via the dev server**

```bash
npm run dev
```

Open the printed local URL in the browser preview, open devtools console, and run:

```js
const { getCourse } = await import('/src/data/index.js')
const { buildLessonContext } = await import('/src/lib/lessonContext.js')
const lesson = getCourse('ai-engineering').allLessons[0]
buildLessonContext(lesson)
```

Expected: a plain-text string starting with `Lesson: Why AI Engineering Is a Different Discipline From ML Research`, followed by `Summary:`, `Key points:`, and `Code reference (python):` sections, with no `<` HTML tags anywhere in the output.

```js
const { loadChatHistory, saveChatHistory } = await import('/src/lib/chatHistoryDB.js')
await saveChatHistory('test-key', [{ role: 'user', content: 'hello' }])
await loadChatHistory('test-key')
```

Expected: `[{ role: 'user', content: 'hello' }]`

```js
await loadChatHistory('a-key-that-was-never-saved')
```

Expected: `[]`

- [ ] **Step 4: Commit**

```bash
git add src/lib/lessonContext.js src/lib/chatHistoryDB.js
git commit -m "Add lesson context flattening and IndexedDB chat history persistence"
```

---

### Task 3: Lesson chat panel UI

**Files:**
- Create: `src/components/LessonChat.jsx`
- Modify: `src/pages/LessonPage.jsx`
- Modify: `src/App.css`
- Create: `.env.example` (project root)

**Interfaces:**
- Consumes: `buildLessonContext(lesson)`, `loadChatHistory(key)`, `saveChatHistory(key, messages)` from Task 2; `POST /api/ask` from Task 1; `import.meta.env.VITE_PROXY_URL`.
- Produces: `export default function LessonChat({ open, onClose, lesson, courseSlug })`, rendered from `LessonPage.jsx`.

- [ ] **Step 1: Create `src/components/LessonChat.jsx`**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Send } from 'lucide-react'
import { buildLessonContext } from '../lib/lessonContext'
import { loadChatHistory, saveChatHistory } from '../lib/chatHistoryDB'

const PROXY_URL = import.meta.env.VITE_PROXY_URL

export default function LessonChat({ open, onClose, lesson, courseSlug }) {
  const historyKey = `${courseSlug}:${lesson.id}`
  const lessonContext = useMemo(() => buildLessonContext(lesson), [lesson])

  const [messages, setMessages] = useState([])
  const [loadedKey, setLoadedKey] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadChatHistory(historyKey).then((saved) => {
      if (cancelled) return
      setMessages(saved)
      setLoadedKey(historyKey)
    })
    return () => { cancelled = true }
  }, [historyKey])

  useEffect(() => {
    if (loadedKey !== historyKey) return
    saveChatHistory(historyKey, messages)
  }, [messages, historyKey, loadedKey])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, open])

  if (!open) return null

  const handleSend = async () => {
    const question = input.trim()
    if (!question || sending) return
    setError(null)
    setInput('')
    const nextMessages = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)

    if (!PROXY_URL) {
      setError("Q&A isn't configured for this build (VITE_PROXY_URL is unset).")
      return
    }

    setSending(true)
    try {
      const res = await fetch(`${PROXY_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonContext, question, history: messages.slice(-10) }),
      })
      if (res.status === 429) {
        setError('Too many questions — please wait a moment and try again.')
        return
      }
      if (!res.ok) {
        setError('The tutor is unavailable right now — please try again later.')
        return
      }
      const data = await res.json()
      setMessages([...nextMessages, { role: 'assistant', content: data.answer }])
    } catch {
      setError("Couldn't reach the tutor service — check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-backdrop" onClick={onClose}>
      <div className="chat-panel" role="dialog" aria-modal="true" aria-label="Ask about this lesson" onClick={(e) => e.stopPropagation()}>
        <div className="chat-header">
          <span>Ask about this lesson</span>
          <button type="button" className="cmdk-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="chat-messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="chat-empty">Ask a question about this lesson — answers are scoped to its content.</div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble chat-${m.role}`}>{m.content}</div>
          ))}
          {sending && <div className="chat-bubble chat-assistant chat-pending">Thinking…</div>}
          {error && <div className="chat-error">{error}</div>}
        </div>
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            placeholder="Ask a question about this lesson…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button type="button" className="sandbox-run-btn" onClick={handleSend} disabled={sending || !input.trim()}>
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the panel into `LessonPage.jsx`**

Modify `src/pages/LessonPage.jsx`. Change the lucide-react import line (currently `import { ChevronRight as Sep, Check, ArrowLeft, ArrowRight, Eye } from 'lucide-react'`) to also import `MessageCircle`:

```js
import { ChevronRight as Sep, Check, ArrowLeft, ArrowRight, Eye, MessageCircle } from 'lucide-react'
```

Add the new component import below the existing `MermaidDiagram` import:

```js
import LessonChat from '../components/LessonChat'
```

Add a new piece of state alongside the existing `solutionRevealed` state:

```js
const [solutionRevealed, setSolutionRevealed] = useState(false)
const [qaOpen, setQaOpen] = useState(false)
```

Add the toggle button inside `badge-row`, immediately after the existing "Mark complete" button. The existing code reads:

```jsx
        <button className={`btn-complete${done ? ' done' : ''}`} onClick={() => toggleComplete(progressKey)}>
          <Check size={14} /> {done ? 'Completed' : 'Mark complete'}
        </button>
```

Change it to:

```jsx
        <button className={`btn-complete${done ? ' done' : ''}`} onClick={() => toggleComplete(progressKey)}>
          <Check size={14} /> {done ? 'Completed' : 'Mark complete'}
        </button>
        <button className="btn-outline" onClick={() => setQaOpen(true)}>
          <MessageCircle size={14} /> Ask about this lesson
        </button>
```

Add the panel render right before the closing `</main>` tag, after `lesson-nav`:

```jsx
      </div>
      <LessonChat open={qaOpen} onClose={() => setQaOpen(false)} lesson={lesson} courseSlug={courseSlug} />
    </main>
  )
}
```

(`courseSlug` and `lesson` are already in scope from the top of the component — no other changes needed.)

- [ ] **Step 3: Add chat panel styles**

Modify `src/App.css` — add at the end of the file:

```css
/* ============ Lesson Q&A chat panel ============ */
.chat-backdrop {
  position: fixed; inset: 0;
  background: transparent;
  z-index: 90;
}
.chat-panel {
  position: fixed;
  top: var(--topbar-h);
  right: 0;
  bottom: 0;
  width: 380px;
  max-width: 100vw;
  display: flex; flex-direction: column;
  background: var(--bg-raised);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  z-index: 91;
}
.chat-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-mute);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.chat-empty {
  color: var(--text-mute);
  font-size: 13px;
  text-align: center;
  margin-top: 20px;
}
.chat-bubble {
  max-width: 90%;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 13.5px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.chat-user { align-self: flex-end; background: var(--accent-soft); color: var(--text); }
.chat-assistant { align-self: flex-start; background: var(--bg-hover); color: var(--text); }
.chat-pending { color: var(--text-mute); font-style: italic; }
.chat-error {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}
.chat-input-row {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}
.chat-input {
  flex: 1;
  resize: none;
  max-height: 120px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--text);
  font-family: var(--font-body);
  font-size: 13.5px;
  outline: none;
}
.chat-input:focus { border-color: var(--accent); }
```

- [ ] **Step 4: Create the root `.env.example`**

Create `.env.example` (project root — this file is safe to commit; it holds no secrets):

```
# See scripts/generate-from-transcripts.py for API_KEY / MODEL / BASE_URL,
# used at build time to generate lesson content — not needed at runtime.

# Optional: base URL of the deployed lesson Q&A proxy (see server/). Leave
# unset to disable network calls from the "Ask about this lesson" panel —
# it will show a "not configured" message instead of failing silently.
VITE_PROXY_URL=
```

- [ ] **Step 5: Verify manually end-to-end**

Ensure the proxy from Task 1 is running (`cd server && npm run dev`) with `RATE_LIMIT_PER_MINUTE=15` and `ALLOWED_ORIGINS=http://localhost:5173` in `server/.env`.

Add to the project-root `.env`:

```
VITE_PROXY_URL=http://localhost:8787
```

Restart the frontend dev server so Vite picks up the new env var:

```bash
npm run dev
```

In the browser preview:
1. Open any lesson in any course. Confirm an "Ask about this lesson" button appears next to "Mark complete".
2. Click it. Confirm a panel slides in from the right showing the empty-state message.
3. Type a question that only makes sense given this specific lesson's content (e.g., for AI Engineering lesson 1.1, "What's the difference between the two roles this lesson describes?") and press Enter.
4. Confirm "Thinking…" appears, then an assistant reply appears that reflects the lesson's actual content (not a generic answer).
5. Reload the page and reopen the panel for the same lesson. Confirm the prior question and answer are still shown (restored from IndexedDB).
6. Navigate to a different lesson and open the panel. Confirm it shows that lesson's own history (empty, unless you'd chatted there before) — not the previous lesson's messages.
7. Stop the proxy server (Ctrl+C in its terminal), ask another question. Confirm the panel shows `Couldn't reach the tutor service — check your connection and try again.` rather than hanging or crashing.
8. Restart the proxy, then in the root `.env` comment out `VITE_PROXY_URL` and restart `npm run dev`. Ask a question. Confirm the panel immediately shows `Q&A isn't configured for this build (VITE_PROXY_URL is unset).` with no network request (check the Network tab — no request to `/api/ask`).
9. Restore `VITE_PROXY_URL=http://localhost:8787` in `.env` afterward.

Check the browser devtools console throughout: no unhandled promise rejections or React errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/LessonChat.jsx src/pages/LessonPage.jsx src/App.css .env.example
git commit -m "Add lesson-scoped Q&A chat panel wired to the proxy server"
```
