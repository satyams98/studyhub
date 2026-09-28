import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Send, Copy, Check, Maximize2, Minimize2 } from 'lucide-react'
import { buildLessonContext } from '../lib/lessonContext'
import { loadChatHistory, saveChatHistory } from '../lib/chatHistoryDB'
import { highlightSource } from '../lib/codeHighlight'

const PROXY_URL = import.meta.env.VITE_PROXY_URL

const MIN_PANEL_WIDTH = 340
const DEFAULT_PANEL_WIDTH = 380
const EXPANDED_PANEL_WIDTH = 760
const WIDTH_STORAGE_KEY = 'study-hub-chat-width'

function clampPanelWidth(width) {
  const max = Math.min(1100, window.innerWidth - 48)
  return Math.min(Math.max(width, MIN_PANEL_WIDTH), Math.max(max, MIN_PANEL_WIDTH))
}

// Splits a streamed chat message into plain-text and fenced-code-block segments.
// Handles a fence that hasn't been closed yet (mid-stream) by treating the
// remainder as an in-progress code block.
function parseChatContent(content) {
  const segments = []
  let i = 0
  const len = content.length
  while (i < len) {
    const fenceStart = content.indexOf('```', i)
    if (fenceStart === -1) {
      segments.push({ type: 'text', value: content.slice(i) })
      break
    }
    if (fenceStart > i) segments.push({ type: 'text', value: content.slice(i, fenceStart) })

    const afterFence = fenceStart + 3
    const newlineIdx = content.indexOf('\n', afterFence)
    const closeIdx = content.indexOf('```', afterFence)
    let lang = ''
    let codeStart = afterFence
    if (newlineIdx !== -1 && (closeIdx === -1 || newlineIdx < closeIdx)) {
      lang = content.slice(afterFence, newlineIdx).trim()
      codeStart = newlineIdx + 1
    }
    if (closeIdx === -1) {
      segments.push({ type: 'code', lang, value: content.slice(codeStart) })
      i = len
    } else {
      segments.push({ type: 'code', lang, value: content.slice(codeStart, closeIdx) })
      i = closeIdx + 3
    }
  }
  return segments
}

function TextSegment({ value }) {
  return value.split(/(`[^`\n]+`)/g).map((part, i) => {
    if (part.length > 1 && part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="chat-inline-code">{part.slice(1, -1)}</code>
    }
    return part ? <span key={i}>{part}</span> : null
  })
}

function ChatCodeBlock({ lang, value }) {
  const [copied, setCopied] = useState(false)
  const code = value.replace(/\n+$/, '')
  const highlightedLines = useMemo(() => highlightSource(code, lang), [code, lang])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard may be unavailable — fail silently
    }
  }

  return (
    <div className="code-block chat-code-block">
      <div className="code-header">
        <span>{lang || 'code'}</span>
        <button type="button" className={`code-copy-btn${copied ? ' copied' : ''}`} onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-body"><code>
        {highlightedLines.map((tokens, li) => (
          <div key={li}>
            {tokens.length === 0 ? ' ' : tokens.map((tok, ti) =>
              tok.cls ? <span key={ti} className={tok.cls}>{tok.text}</span> : <span key={ti}>{tok.text}</span>
            )}
          </div>
        ))}
      </code></pre>
    </div>
  )
}

function ChatMessageContent({ content }) {
  return parseChatContent(content).map((seg, i) =>
    seg.type === 'code'
      ? <ChatCodeBlock key={i} lang={seg.lang} value={seg.value} />
      : <TextSegment key={i} value={seg.value} />
  )
}

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

  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
      if (stored) return clampPanelWidth(stored)
    } catch { /* ignore */ }
    return DEFAULT_PANEL_WIDTH
  })
  const [expanded, setExpanded] = useState(panelWidth >= EXPANDED_PANEL_WIDTH)
  const collapsedWidthRef = useRef(DEFAULT_PANEL_WIDTH)
  const resizingRef = useRef(false)

  useEffect(() => {
    const onResize = () => setPanelWidth((w) => clampPanelWidth(w))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const persistWidth = (width) => {
    try { localStorage.setItem(WIDTH_STORAGE_KEY, String(width)) } catch { /* ignore */ }
  }

  const handleResizeStart = (e) => {
    e.preventDefault()
    resizingRef.current = true
    const onMove = (moveEvt) => {
      if (!resizingRef.current) return
      const next = clampPanelWidth(window.innerWidth - moveEvt.clientX)
      setPanelWidth(next)
      setExpanded(next >= EXPANDED_PANEL_WIDTH)
    }
    const onUp = () => {
      resizingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setPanelWidth((w) => {
        persistWidth(w)
        collapsedWidthRef.current = w < EXPANDED_PANEL_WIDTH ? w : collapsedWidthRef.current
        return w
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const toggleExpand = () => {
    if (expanded) {
      const next = clampPanelWidth(collapsedWidthRef.current)
      setPanelWidth(next)
      setExpanded(false)
      persistWidth(next)
    } else {
      collapsedWidthRef.current = panelWidth
      const next = clampPanelWidth(EXPANDED_PANEL_WIDTH)
      setPanelWidth(next)
      setExpanded(true)
      persistWidth(next)
    }
  }

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
      <div
        className="chat-panel"
        style={{ width: panelWidth }}
        role="dialog"
        aria-modal="true"
        aria-label="Ask about this lesson"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chat-resize-handle" onMouseDown={handleResizeStart} />
        <div className="chat-header">
          <span>Ask about this lesson</span>
          <div className="chat-header-actions">
            <button
              type="button"
              className="cmdk-close-btn"
              onClick={toggleExpand}
              aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button type="button" className="cmdk-close-btn" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="chat-messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="chat-empty">Ask a question about this lesson — answers are scoped to its content.</div>
          )}
          {messages.map((m, i) => (
            m.content ? <div key={i} className={`chat-bubble chat-${m.role}`}><ChatMessageContent content={m.content} /></div> : null
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
