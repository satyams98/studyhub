import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useNavigate } from '../router'
import { search, highlightSnippet } from '../search'

function Highlighted({ text, query }) {
  if (!query) return text
  const parts = highlightSnippet(text, query)
  return parts.map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))
}

function isEditableElement(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

export default function CommandPalette({ open, setOpen }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const previouslyFocusedRef = useRef(null)
  const itemRefs = useRef([])

  const results = useMemo(() => search(query), [query])
  const flatResults = useMemo(
    () => [
      ...results.course.map((e) => ({ ...e, group: 'course' })),
      ...results.lesson.map((e) => ({ ...e, group: 'lesson' })),
      ...results.glossary.map((e) => ({ ...e, group: 'glossary' })),
    ],
    [results]
  )
  const trimmedQuery = query.trim().toLowerCase()

  // Global Ctrl/Cmd+K to open, Escape to close — the palette is always
  // mounted (see App.jsx) so this listener is always live.
  useEffect(() => {
    function onKeyDown(e) {
      const isOpenShortcut = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)
      if (isOpenShortcut) {
        if (!open && isEditableElement(document.activeElement)) return
        e.preventDefault()
        if (!open) setOpen(true)
        return
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        closeAndRestoreFocus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Reset + autofocus whenever the palette opens.
  useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current = document.activeElement
    setQuery('')
    setSelectedIndex(0)
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [open])

  // Reset selection whenever the query (and therefore result set) changes.
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  function closeAndRestoreFocus() {
    setOpen(false)
    previouslyFocusedRef.current?.focus?.()
  }

  function handleSelect(entry) {
    if (!entry) return
    navigate(entry.navigateTo)
    setOpen(false)
  }

  function handleInputKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(flatResults[selectedIndex])
    } else if (e.key === 'Tab') {
      e.preventDefault()
    }
  }

  if (!open) return null

  itemRefs.current = []
  let runningIndex = 0

  function renderGroup(label, items) {
    if (items.length === 0) return null
    const startIndex = runningIndex
    runningIndex += items.length
    return (
      <div className="cmdk-group" key={label}>
        <div className="cmdk-group-label">{label}</div>
        {items.map((item, i) => {
          const flatIdx = startIndex + i
          const isSelected = flatIdx === selectedIndex
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              ref={(el) => { itemRefs.current[flatIdx] = el }}
              className={`cmdk-item${isSelected ? ' selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(flatIdx)}
              onClick={() => handleSelect(item)}
            >
              <span className="cmdk-item-dot" style={{ background: item.courseColor }} />
              <span className="cmdk-item-text">
                <span className="cmdk-item-title">
                  {item.snippetIsTitle ? <Highlighted text={item.title} query={trimmedQuery} /> : item.title}
                </span>
                <span className="cmdk-item-subtitle">{item.subtitle}</span>
                {item.snippet && (
                  <span className="cmdk-item-snippet">
                    <Highlighted text={item.snippet} query={trimmedQuery} />
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  const groupsEl = (
    <>
      {renderGroup('Courses', results.course)}
      {renderGroup('Lessons', results.lesson)}
      {renderGroup('Glossary', results.glossary)}
    </>
  )

  return (
    <div className="cmdk-backdrop" onClick={closeAndRestoreFocus}>
      <div className="cmdk-panel" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Search size={16} className="cmdk-input-icon" />
          <input
            ref={inputRef}
            className="cmdk-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-listbox"
            aria-autocomplete="list"
            placeholder="Search lessons, glossary terms, courses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <kbd className="cmdk-kbd cmdk-esc-hint">Esc</kbd>
          <button type="button" className="cmdk-close-btn" onClick={closeAndRestoreFocus} aria-label="Close search">
            <X size={16} />
          </button>
        </div>
        <div className="cmdk-results" id="cmdk-listbox" role="listbox">
          {flatResults.length === 0 && trimmedQuery && (
            <div className="cmdk-empty">No results for &quot;{query.trim()}&quot;.</div>
          )}
          {groupsEl}
        </div>
      </div>
    </div>
  )
}
