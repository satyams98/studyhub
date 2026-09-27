import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import Sandbox from './Sandbox'

const JAVA_KEYWORDS = new Set([
  'public', 'private', 'protected', 'static', 'final', 'void', 'class', 'interface',
  'extends', 'implements', 'new', 'return', 'if', 'else', 'for', 'while', 'do',
  'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'this', 'super',
  'null', 'true', 'false', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte',
  'var', 'enum', 'switch', 'case', 'break', 'continue', 'default', 'abstract', 'synchronized',
  'volatile', 'transient', 'record',
])

const TYPE_HINT = /^[A-Z][A-Za-z0-9_<>\[\],. ]*$/

// Small regex-based tokenizer — good enough for readable Java/Reactor snippets
// without pulling in a full highlighter dependency.
function highlight(line) {
  const tokens = []
  let i = 0
  const push = (text, cls) => tokens.push({ text, cls })

  while (i < line.length) {
    const rest = line.slice(i)

    // line comment
    if (rest.startsWith('//')) {
      push(rest, 'tok-com')
      break
    }
    // string literal
    const strMatch = rest.match(/^"(?:[^"\\]|\\.)*"/)
    if (strMatch) {
      push(strMatch[0], 'tok-str')
      i += strMatch[0].length
      continue
    }
    // annotation
    const annMatch = rest.match(/^@[A-Za-z_][A-Za-z0-9_]*/)
    if (annMatch) {
      push(annMatch[0], 'tok-ann')
      i += annMatch[0].length
      continue
    }
    // number
    const numMatch = rest.match(/^\b\d+(\.\d+)?[LFDlfd]?\b/)
    if (numMatch) {
      push(numMatch[0], 'tok-num')
      i += numMatch[0].length
      continue
    }
    // identifier / keyword / type
    const idMatch = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (idMatch) {
      const word = idMatch[0]
      if (JAVA_KEYWORDS.has(word)) push(word, 'tok-kw')
      else if (/^[A-Z]/.test(word)) push(word, 'tok-type')
      else push(word, null)
      i += word.length
      continue
    }
    // whitespace / punctuation — advance one char
    push(rest[0], null)
    i += 1
  }
  return tokens
}

export default function CodeBlock({ code, label = 'Example.java' }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null
  if (label === 'python') {
    return <Sandbox code={code} label={label} />
  }
  const lines = code.replace(/\n+$/, '').split('\n')

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
        {lines.map((line, li) => (
          <div key={li}>
            {line.length === 0 ? '\u00A0' : highlight(line).map((tok, ti) =>
              tok.cls ? <span key={ti} className={tok.cls}>{tok.text}</span> : <span key={ti}>{tok.text}</span>
            )}
          </div>
        ))}
      </code></pre>
    </div>
  )
}
