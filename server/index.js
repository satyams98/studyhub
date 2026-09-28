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

// Trust one hop of reverse proxy (e.g. a typical single load balancer/CDN in
// front of this service) so express-rate-limit keys by the real client IP
// instead of the proxy's own address. Increase the hop count if deployed
// behind more than one proxy layer.
app.set('trust proxy', 1)

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

  // Idle timeout: aborts if the upstream goes silent for this long, whether
  // that's before the initial response or a stall partway through the
  // stream. Reset on every chunk received once streaming starts.
  const IDLE_TIMEOUT_MS = 25000
  const controller = new AbortController()
  let idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS)
  const resetIdleTimer = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS)
  }

  let upstream
  try {
    upstream = await fetch(CHAT_COMPLETIONS_URL, {
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
        stream: true,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(idleTimer)
    if (err.name === 'AbortError') {
      console.error('Upstream request timed out')
      return res.status(504).json({ error: 'The model API took too long to respond.' })
    }
    console.error('Proxy request failed', err)
    return res.status(502).json({ error: 'Failed to reach the model API.' })
  }

  if (!upstream.ok) {
    clearTimeout(idleTimer)
    const text = await upstream.text().catch(() => '')
    console.error('Upstream error', upstream.status, text)
    return res.status(502).json({ error: 'The model API returned an error.' })
  }

  // From here on the response is a text/event-stream of {delta} chunks (our
  // own minimal protocol, not the upstream's raw SSE shape) terminated by a
  // literal "[DONE]" event — the client never sees the upstream's own format.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let clientClosed = false
  const reader = upstream.body.getReader()
  req.on('close', () => {
    clientClosed = true
    clearTimeout(idleTimer)
    reader.cancel().catch(() => {})
  })

  const decoder = new TextDecoder()
  let buffer = ''
  let gotContent = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (clientClosed) break
      if (done) break
      resetIdleTimer()
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop()
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        let parsed
        try {
          parsed = JSON.parse(payload)
        } catch {
          continue
        }
        const delta = parsed?.choices?.[0]?.delta?.content
        if (delta) {
          gotContent = true
          res.write(`data: ${JSON.stringify({ delta })}\n\n`)
        }
      }
    }
  } catch (err) {
    console.error('Stream interrupted', err?.message || err)
    if (!clientClosed && !gotContent) {
      res.write(`data: ${JSON.stringify({ error: 'The model API took too long to respond.' })}\n\n`)
    }
  } finally {
    clearTimeout(idleTimer)
  }

  if (clientClosed) return
  if (!gotContent) {
    res.write(`data: ${JSON.stringify({ error: 'The model API returned an empty response.' })}\n\n`)
  }
  res.write('data: [DONE]\n\n')
  res.end()
})

app.listen(PORT, () => {
  console.log(`Lesson Q&A proxy listening on port ${PORT}`)
})
