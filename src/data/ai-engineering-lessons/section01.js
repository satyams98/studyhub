export default [
  {
    id: '1.1',
    title: 'Why AI Engineering Is a Different Discipline From ML Research',
    duration: '10 min',
    kind: 'theory',
    summary: [
      'Two roles get conflated under the label "AI": the <em>ML researcher/engineer</em>, who builds and trains models from raw data, and the <em>AI engineer</em>, who builds products on top of models that already exist. If you are coming from a general software background, the second path is far shorter and far more relevant to shipping real products — you rarely need to train a model to build something useful with one.',
      'An AI engineer\'s core loop looks less like a research notebook and more like a normal backend engineering loop: call a model API or a locally hosted model, structure the input and output around it, wrap that in a service, store state, and handle the failure modes that come from depending on a probabilistic, non-deterministic component. The skills that matter most are the same skills that matter in any distributed system — reliability, testing, observability — applied to a component that occasionally invents facts or returns malformed output.',
      'This does not mean the underlying theory is irrelevant. Understanding <code>tokenization</code>, <code>embeddings</code>, and <code>attention</code> (covered later in this course) changes how you debug a system when retrieval returns the wrong chunk, or when a prompt silently exceeds the context window. But you learn that theory to the depth needed to reason about failures and trade-offs, not to the depth needed to re-derive it from scratch.',
      'The AI engineering stack you will build across this course has a consistent shape: a foundation model (accessed via API or hosted locally) sits at the center; retrieval-augmented generation (RAG) and vector search extend what the model can know; tool-calling and agents extend what it can do; and a conventional backend (API layer, database, deployment pipeline) wraps all of it into something a user or another system can call. Every section of this course adds one layer to that stack.',
      '<strong>Common pitfall:</strong> treating "learn AI" as "learn to train neural networks." For most product-focused roles, the leverage is in composition — retrieval, prompting, orchestration, evaluation — not in training. Spend disproportionate time there, and treat classical ML and deep-learning theory as the minimum needed to not be fooled by how these systems fail.',
    ],
    keyPoints: [
      'AI engineering builds <strong>on top of</strong> existing foundation models; ML engineering <strong>trains</strong> models from data.',
      'The AI engineer\'s daily loop resembles standard backend engineering: API calls, state management, reliability, observability.',
      'Core stack layers: foundation model → retrieval/RAG → tools/agents → backend + deployment.',
      'Theory is learned to the depth needed to debug and reason about failure modes, not to re-derive from first principles.',
      'The highest-leverage skills for this role are composition and reliability engineering, not model training.',
    ],
    code: `# A minimal illustration of the "AI engineer" loop:
# call a model, structure input/output, handle failure — no training involved.

from openai import OpenAI

client = OpenAI()

def summarize(text: str) -> str:
    """Call an LLM to summarize text, with basic failure handling."""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Summarize the user's text in one sentence."},
                {"role": "user", "content": text},
            ],
            timeout=10,
        )
        return response.choices[0].message.content
    except Exception as exc:
        # In production this becomes a retry/fallback, not a bare print —
        # covered in Section 7 (Reliability Engineering for LLM Calls).
        print(f"LLM call failed: {exc}")
        return "Summary unavailable."
`,
    codeLabel: 'python',
    note: {
      label: 'KEY INSIGHT',
      text: 'If you can build a reliable backend service, you already have most of the skills AI engineering needs — the new part is learning where a probabilistic component breaks and how to design around it.',
      tone: 'green',
    },
    quiz: {
      question: 'A team is deciding how to spend their first month learning "AI engineering" for a product role. Which allocation best matches the discipline as covered in this course?',
      options: [
        { label: 'Mostly training and fine-tuning custom models from scratch', correct: false },
        { label: 'Mostly deriving backpropagation and transformer math by hand', correct: false },
        { label: 'Mostly composition: prompting, retrieval, tool-calling, and reliability around an existing model', correct: true },
        { label: 'Mostly learning distributed training infrastructure (e.g. multi-GPU parallelism)', correct: false },
      ],
      explanation: 'AI engineering for product roles is dominated by composing existing foundation models reliably — prompting, RAG, agents, and backend integration — not by training models or deep theoretical derivation. The other options describe ML research/training-infrastructure work, which is a different (and much narrower) role.',
    },
  },
  {
    id: '1.2',
    title: 'Environment, Dependency & Version Management for AI Projects',
    duration: '10 min',
    kind: 'setup',
    summary: [
      'AI projects are unusually version-sensitive compared to typical backend work. A model API version change can alter output formatting; an embedding model upgrade changes vector dimensions, silently breaking a vector index built on the old dimension; a tokenizer version mismatch changes token counts and therefore cost estimates and context-window budgeting. Treating environment and dependency management casually causes bugs that look like model behavior changes but are actually version drift.',
      'Start every project with an isolated virtual environment (<code>venv</code> or a tool like <code>uv</code>/<code>poetry</code>) and a pinned dependency file. Pin not just library versions but also, explicitly, the model identifiers you call (e.g. a dated model snapshot rather than a "latest" alias where the provider allows it) — this is the AI-specific equivalent of pinning a database driver version.',
      'Secrets — API keys for model providers, database credentials — belong in a <code>.env</code> file that is never committed, loaded via a library such as <code>python-dotenv</code>, and referenced through environment variables in code. This matters more in AI projects than typical projects because a leaked model-provider key can generate real, sometimes large, unauthorized billing.',
      'Keep a short <code>requirements.lock</code> or equivalent alongside your loose <code>requirements.txt</code>, and record the exact model/tokenizer versions used to build any persisted artifact (a vector index, a fine-tuned adapter) directly in that artifact\'s metadata. When something goes wrong six months later, "what changed" is almost always answerable from this metadata if you kept it.',
      '<strong>Common pitfall:</strong> upgrading an embedding model without rebuilding the vector index that was built on the old model\'s output. The new model\'s vectors are not comparable to the old ones even if the dimension happens to match — this produces retrieval that looks subtly, confusingly wrong rather than obviously broken.',
    ],
    keyPoints: [
      'Pin library versions <strong>and</strong> model/tokenizer identifiers — not just one or the other.',
      'Use <code>.env</code> + <code>python-dotenv</code> for secrets; never commit API keys.',
      'Record the exact embedding model version used to build any vector index, as artifact metadata.',
      'A "latest" model alias is convenient but unstable — prefer dated/pinned model identifiers for anything you rely on staying stable.',
      '<strong>Version drift</strong> is one of the most common silent-failure causes in AI systems — treat it with the same discipline as a database schema migration.',
    ],
    code: `# .env (never committed — add to .gitignore)
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@localhost:5432/meridian_docs
EMBEDDING_MODEL=text-embedding-3-small

# app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
DATABASE_URL = os.environ["DATABASE_URL"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")

# Store this alongside any vector index you build, so a later
# model upgrade can be detected instead of silently corrupting retrieval:
INDEX_METADATA = {
    "embedding_model": EMBEDDING_MODEL,
    "embedding_dim": 1536,
}
`,
    codeLabel: 'python',
    note: {
      label: 'WARNING',
      text: 'Never mix vectors produced by two different embedding model versions in the same index — rebuild the whole index after any embedding model change.',
      tone: 'accent',
    },
    quiz: {
      question: 'A team upgrades their embedding model provider version. Retrieval quality quietly gets worse, but no errors are thrown. What is the most likely cause?',
      options: [
        { label: 'The new model is simply less capable than the old one', correct: false },
        { label: 'The vector index still contains embeddings from the old model version, now mixed with queries embedded by the new one', correct: true },
        { label: 'The LLM used for generation is unrelated to embeddings and cannot cause this', correct: false },
        { label: 'PostgreSQL silently corrupts vector columns after a schema change', correct: false },
      ],
      explanation: 'Embeddings from different model versions are not directly comparable, even if the vector dimension matches — mixing old and new vectors in one index degrades similarity search without raising any error. The fix is rebuilding the entire index with the new model, not debugging model quality or the database layer.',
    },
  },
  {
    id: '1.3',
    title: 'Writing Robust Python: Context Managers, Generators & Error Handling',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'Three Python patterns show up constantly in AI application code: context managers for resource cleanup, generators for memory-efficient streaming, and structured error handling for the flaky external calls that dominate this domain (model APIs, vector databases, document parsers).',
      'A context manager, written with the <code>with</code> statement or a <code>@contextmanager</code> decorator, guarantees cleanup even when an exception occurs partway through — critical when a function opens a database connection, a file handle for a large document, or a streaming HTTP connection to a model API. Without it, a mid-stream exception during, say, PDF parsing can leave file handles or connections open indefinitely.',
      'Generators matter specifically because AI workloads often process data too large to hold in memory at once — a folder of thousands of documents to embed, or a streamed token-by-token LLM response. A generator function (using <code>yield</code>) processes one item at a time without materializing the whole collection, which is the difference between an ingestion script that scales and one that runs out of memory on a large corpus.',
      'Error handling needs to distinguish between errors worth retrying (a transient network timeout calling a model API), errors worth failing fast on (an invalid API key), and errors worth degrading gracefully on (a single malformed document in a batch of a thousand, where you want the other 999 to still process). Catching a bare <code>Exception</code> and moving on collapses all three into one behavior, which hides real problems.',
      '<strong>Practical guidance:</strong> wrap every external call (model API, vector DB, file I/O) in a narrow try/except that distinguishes these cases explicitly, and use context managers for anything that opens a resource. This is the same discipline any reliable backend service needs — AI workloads just hit it more often because they depend on more external, occasionally unreliable, services per request.',
    ],
    keyPoints: [
      '<code>with</code> / <code>@contextmanager</code> guarantees cleanup even when an exception interrupts the block.',
      'Generators (<code>yield</code>) process large document sets or streamed responses without loading everything into memory at once.',
      'Distinguish <strong>retryable</strong> (network timeout), <strong>fail-fast</strong> (bad credentials), and <strong>skip-and-continue</strong> (one malformed record) errors explicitly.',
      'A bare <code>except Exception: pass</code> hides the difference between these cases and makes failures invisible.',
      'This discipline matters more in AI code than typical code because most requests touch multiple external, occasionally-unreliable services.',
    ],
    code: `from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


@contextmanager
def open_document_batch(folder: Path):
    """Ensures any open file handles are cleaned up even if processing raises."""
    handles = []
    try:
        for path in folder.glob("*.txt"):
            handles.append(open(path, "r", encoding="utf-8"))
        yield handles
    finally:
        for h in handles:
            h.close()


def stream_documents(folder: Path) -> Iterator[str]:
    """Generator: yields one document's text at a time — never holds the whole
    corpus in memory, which matters once the folder has thousands of files."""
    for path in sorted(folder.glob("*.txt")):
        yield path.read_text(encoding="utf-8")


def embed_all(folder: Path) -> list[list[float]]:
    vectors = []
    for text in stream_documents(folder):
        try:
            vectors.append(embed(text))          # retryable: network call
        except TimeoutError:
            vectors.append(embed(text))           # simple one-shot retry
        except ValueError:
            print(f"Skipping malformed document, continuing batch")
            continue                              # skip-and-continue
    return vectors
`,
    codeLabel: 'python',
    note: {
      label: 'COMMON PITFALL',
      text: 'Catching a bare Exception around an entire batch loop silently drops both the documents that failed and the visibility into why — always catch narrowly and log what was skipped.',
      tone: 'accent',
    },
    quiz: {
      question: 'While embedding a folder of 2,000 documents, one file is corrupted and raises a ValueError during parsing. What is the best error-handling strategy?',
      options: [
        { label: 'Wrap the entire batch loop in a bare try/except and log nothing, so the job never crashes', correct: false },
        { label: 'Let the whole job crash so the corrupted file gets noticed immediately', correct: false },
        { label: 'Catch the specific parsing exception around each document, log which document failed, and continue the batch', correct: true },
        { label: 'Retry the corrupted file with exponential backoff until it succeeds', correct: false },
      ],
      explanation: 'A single malformed document shouldn\'t block processing of the other 1,999 — but silently swallowing all errors also hides real problems. Catching the specific exception narrowly, logging which document failed, and continuing gives both resilience and visibility. Retrying assumes the failure is transient, but a parsing ValueError on malformed content will not resolve itself on retry.',
    },
  },
  {
    id: '1.4',
    title: 'Git Workflow and Reproducible Project Structure',
    duration: '8 min',
    kind: 'concept',
    summary: [
      'An AI project has a few structural needs beyond a typical application: a place for data (usually excluded from version control), a place for exploratory notebooks (kept separate from production code), and clear separation between application code and one-off scripts (data generation, index building, evaluation runs).',
      'A workable default layout is: <code>src/</code> for the actual application (API, agents, retrieval logic), <code>scripts/</code> for one-off or periodic jobs (index rebuilding, evaluation runs), <code>notebooks/</code> for exploration that never ships, <code>data/</code> (git-ignored, or tracked with a data-versioning tool if the project grows), and <code>tests/</code> mirroring <code>src/</code>.',
      'Git workflow itself doesn\'t change for AI projects — feature branches, small commits, pull-request review — but the README convention should. Because AI system behavior depends on model versions, prompt versions, and index-build parameters that aren\'t visible in the code diff alone, a good README for an AI project states these explicitly: which model(s) it targets, what the vector index was built from and when, and what evaluation result the current version achieves.',
      'This matters because two commits that look identical in a diff can behave completely differently if one was tested against a different model snapshot. Recording that context in the README (or a dedicated <code>MODEL_CARD.md</code>-style file) is the AI-project equivalent of documenting a database migration.',
    ],
    keyPoints: [
      'Standard layout: <code>src/</code>, <code>scripts/</code>, <code>notebooks/</code>, <code>data/</code> (git-ignored), <code>tests/</code>.',
      'Keep exploratory notebook code out of the application code path entirely.',
      'Document model versions, prompt versions, and index-build parameters in the README — they\'re invisible in a code diff otherwise.',
      'Two commits that look identical can behave differently if tested against different model snapshots — record which one was used.',
      'Standard git practices (small commits, feature branches, PR review) still apply unchanged.',
    ],
    code: `meridian-docs/
├── src/
│   ├── api/              # FastAPI routes
│   ├── retrieval/        # chunking, embedding, vector search
│   ├── agents/            # tool-calling and orchestration
│   └── config.py
├── scripts/
│   ├── build_index.py     # rebuilds the vector index from data/
│   └── run_eval.py        # runs the evaluation harness
├── notebooks/
│   └── exploration.ipynb  # never imported by src/
├── data/                   # .gitignored
├── tests/
│   └── test_retrieval.py
├── .env                    # .gitignored
├── requirements.txt
└── README.md               # states model version, index build date, eval score
`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Without recording model/prompt/index versions in the README, "it worked yesterday" bugs become nearly impossible to diagnose after a provider updates a model behind an alias.',
      tone: 'green',
    },
    quiz: {
      question: 'Why does an AI project\'s README need to record model versions and index-build dates, when a typical backend project\'s README doesn\'t?',
      options: [
        { label: 'It doesn\'t — this is unnecessary overhead copied from ML research habits', correct: false },
        { label: 'Because model behavior and vector index compatibility depend on versions that are invisible in a code diff', correct: true },
        { label: 'Because git cannot track binary files like model weights', correct: false },
        { label: 'Because Python itself requires this information to run', correct: false },
      ],
      explanation: 'A code diff shows what changed in your logic, but not which model snapshot or embedding version produced the current index or was tested against the current prompt — that context has to be recorded explicitly, since two identical-looking commits can behave differently depending on it.',
    },
  },
  {
    id: '1.5',
    title: 'Lab: Building a Text-Analysis CLI Tool',
    duration: '20 min',
    kind: 'assignment',
    summary: [
      'This lab consolidates Lessons 1.1–1.4 into a single working tool: a command-line program that takes a text file and reports word count, sentence count, the most common words, average word length, and the most common bigrams (pairs of consecutive words).',
      'The point of this exercise is not the text statistics themselves — it\'s writing a clean, well-structured small program using the patterns just covered: a generator for reading the file line-by-line rather than loading it all at once, explicit and narrow error handling for a missing or unreadable file, and clear function boundaries with type hints.',
      'Build it as a single Python module with small, independently testable functions — one for tokenization, one for each statistic — rather than one large function that does everything. This mirrors how you\'ll structure ingestion and analysis code later in the course, where each step (chunk, embed, store) needs to be independently testable.',
      'A complete reference solution follows below. Attempt the exercise yourself first — the value is in the attempt, not in reading the solution.',
    ],
    keyPoints: [
      'Use a generator to stream the file rather than loading the whole thing into memory at once.',
      'Handle the "file not found" case explicitly and distinctly from a general parsing failure.',
      'Split the program into small, independently testable functions — one responsibility per function.',
      'Use type hints throughout; they double as documentation for a program this size.',
      'This structure — small composable functions over one large one — is the same shape you\'ll use for chunking and embedding pipelines later in the course.',
    ],
    code: `import re
import sys
from collections import Counter
from pathlib import Path
from typing import Iterator


def read_lines(path: Path) -> Iterator[str]:
    """Generator: yields one line at a time instead of loading the whole file."""
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            yield line


def tokenize_words(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z']+", text.lower())


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]


def most_common_bigrams(words: list[str], top_n: int = 5) -> list[tuple[str, int]]:
    bigrams = zip(words, words[1:])
    return Counter(bigrams).most_common(top_n)


def analyze(path: Path) -> dict:
    full_text = "".join(read_lines(path))
    words = tokenize_words(full_text)
    sentences = split_sentences(full_text)

    return {
        "word_count": len(words),
        "sentence_count": len(sentences),
        "most_common_words": Counter(words).most_common(5),
        "average_word_length": sum(len(w) for w in words) / len(words) if words else 0,
        "most_common_bigrams": most_common_bigrams(words),
    }


def main():
    if len(sys.argv) != 2:
        print("Usage: python analyze.py <path_to_text_file>")
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"Error: file not found — {path}")
        sys.exit(1)

    results = analyze(path)
    for key, value in results.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
`,
    codeLabel: 'python',
    note: {
      label: 'DECISION POINT',
      text: 'If this tool later needs to process a folder of thousands of files instead of one, the generator-based read_lines pattern is what makes that scale without a rewrite.',
      tone: 'green',
    },
    quiz: {
      question: 'The reference solution reads the file with a generator (read_lines) instead of file.read(). What is the main benefit of this choice for this specific tool?',
      options: [
        { label: 'It makes the word-frequency count more accurate', correct: false },
        { label: 'It avoids loading the entire file into memory at once, which matters if this tool is later pointed at very large files', correct: true },
        { label: 'It is required syntax for opening any file in Python', correct: false },
        { label: 'It automatically removes punctuation from the text', correct: false },
      ],
      explanation: 'A generator yields one line at a time rather than materializing the whole file in memory — for a single small text file the difference is invisible, but the same pattern is what lets an ingestion pipeline scale to very large inputs later without a structural rewrite. It has no effect on word-frequency accuracy or punctuation handling.',
    },
    crossRefs: ['1.1', '1.2', '1.3', '1.4'],
  },
]
