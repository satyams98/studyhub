import { useEffect, useRef, useId } from 'react'
import mermaid from 'mermaid'
import { useTheme } from '../context/ThemeContext'

let initializedTheme = null

// Mirrors the palettes in src/index.css (:root and [data-theme="light"]) —
// read as literal values, not via getComputedStyle, since the DOM's
// data-theme attribute update (in ThemeContext) can race this effect.
const PALETTES = {
  dark: {
    bg: '#0B0A09', bgRaised: '#131110', bgHover: '#1B1817',
    border: '#29241F', text: '#EDEAE3', textMute: '#7A7166',
  },
  light: {
    bg: '#FAFAF8', bgRaised: '#FFFFFF', bgHover: '#F2F0ED',
    border: '#E4E0DB', text: '#1C1917', textMute: '#A8A29E',
  },
}
const FONT_MONO = "'JetBrains Mono', 'Fira Code', ui-monospace, monospace"

function buildThemeVariables(theme) {
  const p = PALETTES[theme] || PALETTES.dark
  return {
    background: 'transparent',
    primaryColor: p.bg,
    primaryTextColor: p.text,
    primaryBorderColor: p.border,
    lineColor: p.textMute,
    secondaryColor: p.bgHover,
    tertiaryColor: p.bgHover,
    clusterBkg: p.bgHover,
    clusterBorder: p.border,
    edgeLabelBackground: p.bgRaised,
    nodeTextColor: p.text,
    fontFamily: FONT_MONO,
    fontSize: '13px',
  }
}

const THEME_CSS = `
  .node rect, .node polygon, .node circle { rx: 7px; ry: 7px; stroke-width: 1.25px; }
  .node .label, .nodeLabel { font-weight: 500; }
  .cluster rect { rx: 8px; ry: 8px; stroke-dasharray: 5,4; }
  .cluster-label .nodeLabel, .cluster-label span { text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.06em; }
  .edgeLabel { border-radius: 4px; }
  .marker { stroke-width: 1.25px; }
`

export default function MermaidDiagram({ code }) {
  const containerRef = useRef(null)
  const renderId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { theme } = useTheme()

  useEffect(() => {
    if (!code) return

    if (initializedTheme !== theme) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: buildThemeVariables(theme),
        themeCSS: THEME_CSS,
        securityLevel: 'strict',
        flowchart: { curve: 'basis', padding: 12 },
      })
      initializedTheme = theme
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
