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
