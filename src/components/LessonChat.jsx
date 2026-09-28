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
  const requestGenRef = useRef(0)

  useEffect(() => {
    requestGenRef.current += 1
    setError(null)
    setSending(false)
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
    const myGen = requestGenRef.current
    const nextMessages = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)

    if (!PROXY_URL) {
      setError("Q&A isn't configured for this build (VITE_PROXY_URL is unset).")
      return
    }

    setSending(true)
    // Idle timeout: aborts if the connection goes silent for this long,
    // reset on every chunk received so a long-but-actively-streaming answer
    // is never cut off early.
    const IDLE_TIMEOUT_MS = 30000
    const controller = new AbortController()
    let idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS)
    const resetIdleTimer = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS)
    }

    try {
      const res = await fetch(`${PROXY_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonContext, question, history: messages.slice(-10) }),
        signal: controller.signal,
      })
      if (requestGenRef.current !== myGen) return
      if (res.status === 429) {
        setError('Too many questions — please wait a moment and try again.')
        return
      }
      if (!res.ok) {
        setError('The tutor is unavailable right now — please try again later.')
        return
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''
      let streamError = null

      while (true) {
        const { done, value } = await reader.read()
        if (requestGenRef.current !== myGen) {
          reader.cancel().catch(() => {})
          return
        }
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
          if (parsed.delta) {
            accumulated += parsed.delta
            const text = accumulated
            setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { role: 'assistant', content: text } : m)))
          } else if (parsed.error) {
            streamError = parsed.error
          }
        }
      }

      if (requestGenRef.current !== myGen) return
      if (streamError) {
        setError(streamError)
        if (!accumulated) setMessages((prev) => prev.slice(0, -1))
      }
    } catch {
      if (requestGenRef.current === myGen) {
        setError("Couldn't reach the tutor service — check your connection and try again.")
      }
    } finally {
      clearTimeout(idleTimer)
      if (requestGenRef.current === myGen) setSending(false)
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
            m.content ? <div key={i} className={`chat-bubble chat-${m.role}`}>{m.content}</div> : null
          ))}
          {sending && !messages[messages.length - 1]?.content && (
            <div className="chat-bubble chat-assistant chat-pending">Thinking…</div>
          )}
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
          <button
            type="button"
            className="chat-send-btn"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            aria-label="Send"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
