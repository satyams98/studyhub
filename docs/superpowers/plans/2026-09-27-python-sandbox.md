# In-Browser Python Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let learners run and edit Python code snippets directly on AI Engineering lesson pages, in-browser, with no backend.

**Architecture:** A lazily-loaded, cached Pyodide (CPython-in-WASM) runtime, loaded from CDN on first use. A new `Sandbox` component replaces the read-only code block for any snippet labeled `python`, adding an editable textarea, a Run button, and an output panel (stdout + rendered matplotlib figures + friendly error fallback).

**Tech Stack:** Pyodide (loaded from jsdelivr CDN at runtime, not an npm dependency), React (existing), no new npm packages, no new test framework.

## Global Constraints

- This repo has no automated test framework (no vitest/jest, verified via `package.json` and a repo-wide search for `*.test.js*` — none exist) and the approved spec (`docs/superpowers/specs/2026-09-27-sandbox-and-lesson-qa-design.md`) explicitly calls for manual browser verification for this feature. Every task below is verified by hand in the browser preview (per the `run` skill / preview tools), not by an automated test suite. Do not introduce a test framework as part of this plan — out of scope.
- Pyodide must be loaded from CDN at runtime, never bundled into the Vite build (`vite-plugin-singlefile` inlines everything it can see at build time; a multi-megabyte WASM runtime must stay a lazy runtime fetch, not part of the single HTML file).
- Sandbox only activates when `codeLabel === 'python'` (exact match, case-sensitive, matching the existing convention in `src/data/ai-engineering-lessons/*.js`). All other languages keep using the existing read-only `CodeBlock` rendering unchanged.
- PyTorch and any other package with no Pyodide-compatible wheel must fail with a short, human-readable message — never a raw Python traceback dump.
- No new npm dependencies are required for this plan.

---

### Task 1: Pyodide runtime engine

**Files:**
- Create: `src/lib/pyodideRuntime.js`

**Interfaces:**
- Produces: `export async function runPythonSnippet(code: string): Promise<{ stdout: string, stderr: string, images: string[], error: string|null }>` — `images` is an array of base64-encoded PNG strings (no `data:` prefix). `error` is `null` on success, or a short human-readable string on failure. This is the only export later tasks depend on.

- [ ] **Step 1: Create the runtime module**

Create `src/lib/pyodideRuntime.js`:

```js
// Lazily loads Pyodide (CPython compiled to WebAssembly) from its CDN and
// runs Python snippets in an isolated namespace per call. Never bundled by
// Vite — the runtime and its packages are fetched on first use only.

const PYODIDE_VERSION = 'v0.26.2'
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`

let pyodideLoadingPromise = null
let packagesReadyPromise = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

async function getPyodide() {
  if (!pyodideLoadingPromise) {
    pyodideLoadingPromise = (async () => {
      await loadScript(PYODIDE_CDN)
      return window.loadPyodide()
    })()
  }
  return pyodideLoadingPromise
}

async function ensurePackages(pyodide) {
  if (!packagesReadyPromise) {
    packagesReadyPromise = (async () => {
      await pyodide.loadPackage('micropip')
      const micropip = pyodide.pyimport('micropip')
      await micropip.install(['numpy', 'matplotlib'])
    })()
  }
  return packagesReadyPromise
}

const FIGURE_CAPTURE_PRELUDE = `
import matplotlib
matplotlib.use('AGG')
`

const CAPTURE_FIGURES_SNIPPET = `
import base64, io
_sandbox_images = []
try:
    import matplotlib.pyplot as plt
    for _num in plt.get_fignums():
        _fig = plt.figure(_num)
        _buf = io.BytesIO()
        _fig.savefig(_buf, format='png', bbox_inches='tight')
        _sandbox_images.append(base64.b64encode(_buf.getvalue()).decode('ascii'))
    plt.close('all')
except ImportError:
    pass
_sandbox_images
`

// Packages with no Pyodide-compatible wheel — mapped to a short, specific
// reason so learners see something more useful than a bare traceback.
const UNSUPPORTED_PACKAGE_REASONS = {
  torch: "PyTorch isn't available in the browser runtime (no WebAssembly build exists).",
  tensorflow: "TensorFlow isn't available in the browser runtime (no WebAssembly build exists).",
  uvicorn: "A real server can't bind a network port in the browser — try exercising the app with FastAPI's TestClient instead.",
}

function describeError(err) {
  const message = err?.message || String(err)
  for (const [pkg, reason] of Object.entries(UNSUPPORTED_PACKAGE_REASONS)) {
    if (message.includes(`No module named '${pkg}'`)) return reason
  }
  const lines = message.trim().split('\n').filter(Boolean)
  return lines[lines.length - 1] || message
}

export async function runPythonSnippet(code) {
  const pyodide = await getPyodide()
  await ensurePackages(pyodide)

  let stdout = ''
  let stderr = ''
  pyodide.setStdout({ batched: (s) => { stdout += s + '\n' } })
  pyodide.setStderr({ batched: (s) => { stderr += s + '\n' } })

  const namespace = pyodide.toPy({})
  try {
    await pyodide.runPythonAsync(FIGURE_CAPTURE_PRELUDE, { globals: namespace })
    await pyodide.runPythonAsync(code, { globals: namespace })
    const figuresResult = await pyodide.runPythonAsync(CAPTURE_FIGURES_SNIPPET, { globals: namespace })
    const images = figuresResult ? figuresResult.toJs() : []
    return { stdout: stdout.trim(), stderr: stderr.trim(), images, error: null }
  } catch (err) {
    return { stdout: stdout.trim(), stderr: stderr.trim(), images: [], error: describeError(err) }
  } finally {
    pyodide.setStdout({})
    pyodide.setStderr({})
    namespace.destroy()
  }
}
```

- [ ] **Step 2: Verify manually via the dev server**

Run:

```bash
npm run dev
```

Open the printed local URL in the browser preview, then open the browser's devtools console on that page and run each of the following, waiting for each to resolve before running the next (the first call downloads Pyodide + numpy/matplotlib, so it takes several seconds):

```js
const { runPythonSnippet } = await import('/src/lib/pyodideRuntime.js')
await runPythonSnippet('print(1 + 1)')
```
Expected: `{ stdout: '2', stderr: '', images: [], error: null }`

```js
await runPythonSnippet('import numpy as np\nprint(np.array([1,2,3]).sum())')
```
Expected: `{ stdout: '6', stderr: '', images: [], error: null }`

```js
await runPythonSnippet('import matplotlib.pyplot as plt\nplt.plot([1,2,3],[1,4,9])')
```
Expected: `error: null`, `images` is an array with exactly one non-empty base64 string.

```js
await runPythonSnippet('import torch')
```
Expected: `error: "PyTorch isn't available in the browser runtime (no WebAssembly build exists)."`, `stdout: ''`.

```js
await runPythonSnippet('x = 1\nraise ValueError("boom")')
```
Expected: `error` is a short string ending in `ValueError: boom` (not a full multi-line traceback), `stdout: ''`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pyodideRuntime.js
git commit -m "Add lazily-loaded Pyodide runtime for the code sandbox"
```

---

### Task 2: Sandbox component

**Files:**
- Create: `src/components/Sandbox.jsx`
- Test (manual): AI Engineering course, lessons 2.1, 2.4, 5.3 (see Step 4)

**Interfaces:**
- Consumes: `runPythonSnippet(code)` from `src/lib/pyodideRuntime.js` (Task 1).
- Produces: `export default function Sandbox({ code, label })` — a drop-in replacement for the read-only code block, used by Task 3.

- [ ] **Step 1: Create the component**

Create `src/components/Sandbox.jsx`:

```jsx
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
```

- [ ] **Step 2: Wire it into `CodeBlock`**

Modify `src/components/CodeBlock.jsx` — add the import at the top and branch at the start of the component body:

```js
import Sandbox from './Sandbox'
```

```js
export default function CodeBlock({ code, label = 'Example.java' }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null
  if (label === 'python') {
    return <Sandbox code={code} label={label} />
  }
  const lines = code.replace(/\n+$/, '').split('\n')
```

(This replaces the existing `if (!code) return null` + `const lines = ...` lines at the top of the function — the rest of `CodeBlock.jsx` is unchanged.)

- [ ] **Step 3: Add sandbox styles**

Modify `src/App.css` — insert immediately after the existing `.code-body` rule block (after the `.tok-ann` line, before the `/* ============ Prev/Next ============ */` comment, around line 509):

```css
.sandbox-actions { display: flex; gap: 8px; }
.sandbox-run-btn {
  display: flex; align-items: center; gap: 5px;
  background: var(--accent);
  border: none;
  color: #1D0F09;
  font-weight: 600;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 5px;
  font-family: var(--font-body);
  transition: filter .15s;
}
.sandbox-run-btn:hover { filter: brightness(1.08); }
.sandbox-run-btn:disabled { opacity: 0.6; cursor: default; }
.sandbox-editor {
  display: block;
  width: 100%;
  margin: 0;
  padding: 16px 20px;
  border: none;
  outline: none;
  resize: vertical;
  background: transparent;
  color: var(--code-text);
  font-family: var(--font-mono);
  font-size: 13.3px;
  line-height: 1.65;
  tab-size: 2;
}
.sandbox-output {
  border-top: 1px solid var(--border);
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sandbox-stdout {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--code-text);
  white-space: pre-wrap;
}
.sandbox-image {
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid var(--border);
}
.sandbox-error {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}
.sandbox-empty {
  color: var(--text-mute);
  font-size: 13px;
  font-style: italic;
}
```

- [ ] **Step 4: Verify manually in the browser**

With `npm run dev` running, open the app, click into the **AI Engineering** course from the homepage, then navigate to **Section 1: Python & Engineering Foundations for AI**.

Confirm non-Python lessons are unaffected: any Java-labeled lesson in another course still shows the plain read-only code block with only a Copy button (no Run/Reset, no editable textarea).

Navigate to **Section 2: Data Handling with NumPy & Pandas → lesson 2.1 "NumPy Arrays, Broadcasting & Vectorization"**:
- Confirm the code block is now an editable textarea pre-filled with the lesson's NumPy snippet, with Copy, Reset, and Run buttons.
- Click Run. Expected output panel shows exactly:
  ```
  (3, 4)
  (3, 4)
  ```
  with no error and no images.
- Edit the textarea (e.g. change `embeddings.mean(axis=0)` to `embeddings.max(axis=0)`), click Run again, and confirm the output changes accordingly (no error).
- Click Reset and confirm the textarea reverts to the original snippet.

Navigate to **lesson 2.4 "Lab: End-to-End Exploratory Data Analysis Report"** (the snippet with `plt.savefig("churn_by_month.png")`):
- Click Run. Confirm the output panel renders a plot image below any stdout, with no error.

Navigate to **Section 5: Deep Learning Foundations & PyTorch → lesson 5.3 "PyTorch Tensors, Autograd & the Training Loop"**:
- Click Run. Confirm the output panel shows the friendly message `Couldn't run this in-browser: PyTorch isn't available in the browser runtime (no WebAssembly build exists).` — not a raw traceback.

Check the browser devtools console throughout: no unhandled promise rejections or React errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sandbox.jsx src/components/CodeBlock.jsx src/App.css
git commit -m "Add editable in-browser Python sandbox to lesson code blocks"
```
