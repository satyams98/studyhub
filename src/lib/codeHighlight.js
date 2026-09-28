// Small regex-based syntax highlighter — good enough for readable code
// snippets across the languages this course (and its Q&A tutor) actually
// uses, without pulling in a full highlighter dependency.

const JAVA_KEYWORDS = new Set([
  'public', 'private', 'protected', 'static', 'final', 'void', 'class', 'interface',
  'extends', 'implements', 'new', 'return', 'if', 'else', 'for', 'while', 'do',
  'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'this', 'super',
  'null', 'true', 'false', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte',
  'var', 'enum', 'switch', 'case', 'break', 'continue', 'default', 'abstract', 'synchronized',
  'volatile', 'transient', 'record',
])

const JS_KEYWORDS = new Set([
  'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
  'continue', 'class', 'extends', 'new', 'this', 'super', 'import', 'export', 'from', 'as',
  'const', 'let', 'var', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of',
  'null', 'undefined', 'true', 'false', 'async', 'await', 'yield', 'default', 'void', 'delete',
  'static', 'get', 'set',
])

const GO_KEYWORDS = new Set([
  'func', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface', 'return',
  'if', 'else', 'for', 'range', 'switch', 'case', 'break', 'continue', 'go', 'chan',
  'select', 'defer', 'map', 'nil', 'true', 'false',
])

const RUST_KEYWORDS = new Set([
  'fn', 'let', 'mut', 'if', 'else', 'match', 'for', 'while', 'loop', 'return', 'struct',
  'enum', 'impl', 'trait', 'use', 'pub', 'mod', 'self', 'Self', 'true', 'false', 'None', 'Some',
])

const C_KEYWORDS = new Set([
  'int', 'long', 'double', 'float', 'char', 'void', 'struct', 'enum', 'union', 'typedef',
  'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'default', 'const', 'static', 'sizeof', 'NULL', 'true', 'false', 'class', 'public',
  'private', 'protected', 'namespace', 'template', 'new', 'delete', 'this',
])

const BASH_KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'for', 'do', 'done', 'while', 'function', 'return',
  'echo', 'export', 'local', 'case', 'esac', 'in',
])

const SQL_KEYWORDS = new Set([
  'select', 'from', 'where', 'insert', 'update', 'delete', 'join', 'on', 'group', 'by',
  'order', 'as', 'and', 'or', 'not', 'null', 'values', 'into', 'create', 'table', 'primary',
  'key', 'drop', 'set', 'left', 'right', 'inner', 'outer', 'having', 'limit', 'distinct',
])

const PYTHON_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
  'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
  'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass',
  'raise', 'return', 'try', 'while', 'with', 'yield', 'match', 'case',
])

const PYTHON_BUILTINS = new Set([
  'print', 'len', 'range', 'int', 'str', 'float', 'bool', 'list', 'dict', 'set',
  'tuple', 'type', 'isinstance', 'super', 'self', 'open', 'enumerate', 'zip',
  'map', 'filter', 'sorted', 'sum', 'min', 'max', 'abs', 'round', 'input',
])

const LANG_CONFIG = {
  java: { keywords: JAVA_KEYWORDS, commentPrefix: '//' },
  javascript: { keywords: JS_KEYWORDS, commentPrefix: '//' },
  go: { keywords: GO_KEYWORDS, commentPrefix: '//' },
  rust: { keywords: RUST_KEYWORDS, commentPrefix: '//' },
  c: { keywords: C_KEYWORDS, commentPrefix: '//' },
  bash: { keywords: BASH_KEYWORDS, commentPrefix: '#' },
  sql: { keywords: SQL_KEYWORDS, commentPrefix: '--', caseInsensitive: true },
  yaml: { keywords: null, commentPrefix: '#' },
  json: { keywords: null, commentPrefix: null },
  plain: { keywords: null, commentPrefix: '//' },
}

const LANG_ALIASES = {
  py: 'python', python3: 'python',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'javascript', tsx: 'javascript', typescript: 'javascript', node: 'javascript',
  sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
  golang: 'go',
  rs: 'rust',
  'c++': 'c', cpp: 'c', cc: 'c', h: 'c', hpp: 'c', 'c#': 'c', csharp: 'c',
  yml: 'yaml',
}

// Resolves a fence/label string (e.g. "python", "Example.java", "ts") to a
// canonical key into LANG_CONFIG, or 'python' which is handled separately.
export function resolveLang(label) {
  if (!label) return 'plain'
  const raw = label.trim().toLowerCase()
  const key = raw.includes('.') ? raw.split('.').pop() : raw
  return LANG_ALIASES[key] || key
}

function tokenizeGenericLine(line, { keywords, builtins, commentPrefix, caseInsensitive } = {}) {
  const tokens = []
  let i = 0
  const push = (text, cls) => tokens.push({ text, cls })
  const norm = (word) => (caseInsensitive ? word.toLowerCase() : word)

  while (i < line.length) {
    const rest = line.slice(i)

    if (commentPrefix && rest.startsWith(commentPrefix)) {
      push(rest, 'tok-com')
      break
    }
    const strMatch = rest.match(/^[a-zA-Z]{0,2}(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/)
    if (strMatch) {
      push(strMatch[0], 'tok-str')
      i += strMatch[0].length
      continue
    }
    const annMatch = rest.match(/^@[A-Za-z_][A-Za-z0-9_]*/)
    if (annMatch) {
      push(annMatch[0], 'tok-ann')
      i += annMatch[0].length
      continue
    }
    const numMatch = rest.match(/^\b\d+(\.\d+)?[LFDlfd]?\b/)
    if (numMatch) {
      push(numMatch[0], 'tok-num')
      i += numMatch[0].length
      continue
    }
    const idMatch = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (idMatch) {
      const word = idMatch[0]
      if (keywords?.has(norm(word))) push(word, 'tok-kw')
      else if (builtins?.has(norm(word))) push(word, 'tok-type')
      else if (/^[A-Z]/.test(word)) push(word, 'tok-type')
      else push(word, null)
      i += word.length
      continue
    }
    push(rest[0], null)
    i += 1
  }
  return tokens
}

// Whole-source, line-splitting tokenizer (not per-line) so triple-quoted
// strings that span multiple lines still highlight correctly — unlike a
// per-line scan, which would lose track of "still inside a string" at each
// line break.
function tokenizePython(source) {
  const lines = [[]]
  const pushText = (text, cls) => {
    const segments = text.split('\n')
    segments.forEach((seg, idx) => {
      if (idx > 0) lines.push([])
      if (seg.length > 0) lines[lines.length - 1].push({ text: seg, cls })
    })
  }

  let i = 0
  while (i < source.length) {
    const rest = source.slice(i)

    const tripleMatch = rest.match(/^[a-zA-Z]{0,2}("""[\s\S]*?"""|'''[\s\S]*?''')/)
    if (tripleMatch) {
      pushText(tripleMatch[0], 'tok-str')
      i += tripleMatch[0].length
      continue
    }
    if (rest[0] === '#') {
      const end = rest.indexOf('\n')
      const commentText = end === -1 ? rest : rest.slice(0, end)
      pushText(commentText, 'tok-com')
      i += commentText.length
      continue
    }
    const strMatch = rest.match(/^[a-zA-Z]{0,2}("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/)
    if (strMatch) {
      pushText(strMatch[0], 'tok-str')
      i += strMatch[0].length
      continue
    }
    if (rest[0] === '\n') {
      lines.push([])
      i += 1
      continue
    }
    const decMatch = rest.match(/^@[A-Za-z_][A-Za-z0-9_.]*/)
    if (decMatch) {
      pushText(decMatch[0], 'tok-ann')
      i += decMatch[0].length
      continue
    }
    const numMatch = rest.match(/^\d+(\.\d+)?([eE][+-]?\d+)?[jJ]?\b/)
    if (numMatch) {
      pushText(numMatch[0], 'tok-num')
      i += numMatch[0].length
      continue
    }
    const idMatch = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (idMatch) {
      const word = idMatch[0]
      const cls = PYTHON_KEYWORDS.has(word) ? 'tok-kw' : PYTHON_BUILTINS.has(word) ? 'tok-type' : null
      pushText(word, cls)
      i += word.length
      continue
    }
    pushText(rest[0], null)
    i += 1
  }

  return lines
}

export { tokenizePython }

// Tokenizes a full source string into an array of per-line token arrays,
// picking the right strategy for the resolved language.
export function highlightSource(code, lang, { fallback = 'plain' } = {}) {
  const canonical = resolveLang(lang)
  if (canonical === 'python') return tokenizePython(code)
  const config = LANG_CONFIG[canonical] || LANG_CONFIG[fallback] || LANG_CONFIG.plain
  return code.split('\n').map((line) => tokenizeGenericLine(line, config))
}
