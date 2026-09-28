import { useMemo, useState, useRef } from 'react'
import { Play, RotateCcw, Copy, Check, Loader2 } from 'lucide-react'
import { runPythonSnippet, isPyodideReady } from '../lib/pyodideRuntime'
import { tokenizePython } from '../lib/codeHighlight'

export default function Sandbox({ code: initialCode, label }) {
  const [code, setCode] = useState(initialCode)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loadingRuntime, setLoadingRuntime] = useState(false)
  const originalCode = useRef(initialCode)

  const highlightedLines = useMemo(() => tokenizePython(code), [code])

  const handleRun = async () => {
    setLoadingRuntime(!isPyodideReady())
    setRunning(true)
    try {
      const r = await runPythonSnippet(code)
      setResult(r)
    } finally {
      setRunning(false)
      setLoadingRuntime(false)
    }
  }

  const handleReset = () => {
    setCode(originalCode.current)
    setResult(null)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be unavailable — fail silently
    }
  }

  return (
    <div className="code-block sandbox-block">
      <div className="code-header">
        <span>{label}</span>
        <div className="sandbox-actions">
          <button type="button" className="code-copy-btn" onClick={handleCopy}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="code-copy-btn" onClick={handleReset} disabled={running}>
            <RotateCcw size={12} /> Reset
          </button>
          <button type="button" className="sandbox-run-btn" onClick={handleRun} disabled={running}>
            {running ? <Loader2 size={12} className="sandbox-spin" /> : <Play size={12} />}
            {running ? (loadingRuntime ? 'Loading Python runtime…' : 'Running…') : 'Run'}
          </button>
        </div>
      </div>
      <div className="sandbox-editor-wrap">
        <pre className="sandbox-highlight" aria-hidden="true">
          <code>
            {highlightedLines.map((tokens, li) => (
              <div key={li}>
                {tokens.length === 0 ? ' ' : tokens.map((tok, ti) =>
                  tok.cls ? <span key={ti} className={tok.cls}>{tok.text}</span> : <span key={ti}>{tok.text}</span>
                )}
              </div>
            ))}
          </code>
        </pre>
        <textarea
          className="sandbox-editor"
          value={code}
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      {result && (
        <div className="sandbox-output">
          <div className="sandbox-output-label">Output</div>
          {result.stdout && <pre className="sandbox-stdout">{result.stdout}</pre>}
          {result.images.map((b64, i) => (
            <img key={i} className="sandbox-image" src={`data:image/png;base64,${b64}`} alt={`Plot ${i + 1}`} />
          ))}
          {result.error && (
            <div className="sandbox-error">Couldn't run this in-browser: {result.error}</div>
          )}
          {!result.stdout && !result.error && result.images.length === 0 && (
            <div className="sandbox-empty">Ran with no output.</div>
          )}
        </div>
      )}
    </div>
  )
}
