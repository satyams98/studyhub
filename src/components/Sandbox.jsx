import { useState, useRef } from 'react'
import { Play, RotateCcw, Copy, Check } from 'lucide-react'
import { runPythonSnippet } from '../lib/pyodideRuntime'

export default function Sandbox({ code: initialCode, label }) {
  const [code, setCode] = useState(initialCode)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const originalCode = useRef(initialCode)

  const handleRun = async () => {
    setRunning(true)
    try {
      const r = await runPythonSnippet(code)
      setResult(r)
    } finally {
      setRunning(false)
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
            <Play size={12} /> {running ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>
      <textarea
        className="sandbox-editor"
        value={code}
        spellCheck={false}
        onChange={(e) => setCode(e.target.value)}
        rows={Math.max(4, code.split('\n').length)}
      />
      {result && (
        <div className="sandbox-output">
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
