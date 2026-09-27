import { useEffect, useRef, useId } from 'react'
import mermaid from 'mermaid'
import { useTheme } from '../context/ThemeContext'

let initializedTheme = null

export default function MermaidDiagram({ code }) {
  const containerRef = useRef(null)
  const renderId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { theme } = useTheme()

  useEffect(() => {
    if (!code) return
    const mermaidTheme = theme === 'light' ? 'default' : 'dark'

    if (initializedTheme !== mermaidTheme) {
      mermaid.initialize({ startOnLoad: false, theme: mermaidTheme, securityLevel: 'strict' })
      initializedTheme = mermaidTheme
    }

    let cancelled = false
    mermaid
      .render(`mmd-${renderId}`, code)
      .then(({ svg }) => {
        if (!cancelled && containerRef.current) containerRef.current.innerHTML = svg
      })
      .catch((err) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = `<div class="mermaid-error">Diagram error: ${String(err?.message || err).slice(0, 200)}</div>`
        }
      })

    return () => { cancelled = true }
  }, [code, theme, renderId])

  if (!code) return null

  return <div className="diagram-block mermaid-block" ref={containerRef} />
}
