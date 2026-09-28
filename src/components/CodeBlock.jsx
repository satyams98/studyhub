import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import Sandbox from './Sandbox'
import { highlightSource } from '../lib/codeHighlight'

export default function CodeBlock({ code, label = 'Example.java' }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null
  if (label === 'python') {
    return <Sandbox key={code} code={code} label={label} />
  }
  const trimmed = code.replace(/\n+$/, '')
  const lines = trimmed.split('\n')
  const highlightedLines = highlightSource(trimmed, label, { fallback: 'java' })

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
    <div className="code-block">
      <div className="code-header">
        <span>{label}</span>
        <button className={`code-copy-btn${copied ? ' copied' : ''}`} onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-body"><code>
        {highlightedLines.map((tokens, li) => (
          <div key={li}>
            {lines[li].length === 0 ? '\u00A0' : tokens.map((tok, ti) =>
              tok.cls ? <span key={ti} className={tok.cls}>{tok.text}</span> : <span key={ti}>{tok.text}</span>
            )}
          </div>
        ))}
      </code></pre>
    </div>
  )
}
