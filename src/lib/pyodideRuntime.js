// Lazily loads Pyodide (CPython compiled to WebAssembly) from its CDN and
// runs Python snippets in an isolated namespace per call. Never bundled by
// Vite — the runtime and its packages are fetched on first use only.

const PYODIDE_VERSION = 'v0.26.2'
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`

let pyodideLoadingPromise = null
let packagesReadyPromise = null
let isReady = false

export function isPyodideReady() {
  return isReady
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      reject(new Error(`Failed to load ${src}`))
    }
    document.head.appendChild(script)
  })
}

async function getPyodide() {
  if (!pyodideLoadingPromise) {
    pyodideLoadingPromise = (async () => {
      await loadScript(PYODIDE_CDN)
      return window.loadPyodide()
    })().catch((err) => {
      pyodideLoadingPromise = null
      throw err
    })
  }
  return pyodideLoadingPromise
}

async function ensurePackages(pyodide) {
  if (!packagesReadyPromise) {
    packagesReadyPromise = (async () => {
      await pyodide.loadPackage('micropip')
      const micropip = pyodide.pyimport('micropip')
      await micropip.install(['numpy', 'matplotlib'])
    })().catch((err) => {
      packagesReadyPromise = null
      throw err
    })
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
  let stdout = ''
  let stderr = ''
  try {
    const pyodide = await getPyodide()
    await ensurePackages(pyodide)
    isReady = true

    pyodide.setStdout({ batched: (s) => { stdout += s + '\n' } })
    pyodide.setStderr({ batched: (s) => { stderr += s + '\n' } })

    const namespace = pyodide.toPy({})
    try {
      await pyodide.runPythonAsync(FIGURE_CAPTURE_PRELUDE, { globals: namespace })
      await pyodide.runPythonAsync(code, { globals: namespace })
      const figuresResult = await pyodide.runPythonAsync(CAPTURE_FIGURES_SNIPPET, { globals: namespace })
      const images = figuresResult ? figuresResult.toJs() : []
      return { stdout: stdout.trim(), stderr: stderr.trim(), images, error: null }
    } finally {
      pyodide.setStdout({})
      pyodide.setStderr({})
      namespace.destroy()
    }
  } catch (err) {
    return { stdout: stdout.trim(), stderr: stderr.trim(), images: [], error: describeError(err) }
  }
}
