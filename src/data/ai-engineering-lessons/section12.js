export default [
  {
    id: '12.1',
    title: 'Containerizing AI Applications With Docker',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'The FastAPI service built in Section 11 depends on a specific Python version, specific library versions (Section 1.2\'s version-sensitivity concerns apply directly here), and external services (PostgreSQL, a vector database) — running it reliably outside your own development machine requires packaging all of this consistently, which is exactly what Docker containers solve.',
      'A <code>Dockerfile</code> describes how to build an image: starting from a base image (typically a specific Python version, matching Section 1.2\'s pinning discipline), copying application code, installing dependencies from a pinned requirements file, and specifying the command that runs the application. A <em>multi-stage build</em> uses separate stages for building dependencies versus running the final application, which keeps the final image smaller by discarding build-time-only tools and intermediate files that aren\'t needed at runtime.',
      '<code>docker-compose</code> defines and runs multiple related containers together as one unit — for the Meridian Docs application, this typically means the FastAPI service, a PostgreSQL container (Section 11.3), and potentially a separate vector database container, all configured to network with each other automatically, which matches local development to something structurally close to a real deployment far more closely than running each piece separately by hand.',
      'A container image built once should behave identically wherever it runs (a developer\'s laptop, a CI pipeline, production) — this reproducibility is the core value Docker provides, directly closing the "works on my machine" gap that Section 1.2\'s environment-pinning discipline addresses at the Python-dependency level, now extended to the entire runtime environment including the OS-level dependencies Python itself doesn\'t manage.',
      '<strong>Practical guidance:</strong> pin the base image to a specific version tag (e.g. <code>python:3.12.4-slim</code>), not a floating tag like <code>python:latest</code> — the same version-drift risk from Section 1.2 applies here: a floating base image tag means the exact same Dockerfile can silently produce a different image weeks apart as the underlying tag\'s target changes.',
    ],
    keyPoints: [
      'A <code>Dockerfile</code> packages the application, its pinned dependencies, and its runtime command into a reproducible image — extending Section 1.2\'s version-pinning discipline to the whole runtime environment.',
      '<strong>Multi-stage builds</strong> separate build-time tooling from the final runtime image, keeping the deployed image smaller.',
      '<code>docker-compose</code> runs multiple related containers (the API service, PostgreSQL, a vector database) together as one networked unit, closely matching local development to real deployment structure.',
      'A container image built once behaves identically everywhere it runs — this reproducibility is Docker\'s core value, closing the "works on my machine" gap.',
      'Pin the base image to a specific version tag, not a floating one like <code>latest</code> — the same version-drift risk from Section 1.2 applies at the container level.',
    ],
    code: `# Dockerfile — multi-stage build for the Section 11 FastAPI service

# --- Stage 1: build dependencies ---
FROM python:3.12.4-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# --- Stage 2: final runtime image — only what's needed to RUN the app ---
FROM python:3.12.4-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`,
    codeLabel: 'terminal',
    note: {
      label: 'COMMON PITFALL',
      text: 'Using a floating base image tag like python:latest means the same Dockerfile can silently build a different image weeks or months later — pin to a specific version tag, exactly as Section 1.2 recommends for Python dependencies.',
      tone: 'accent',
    },
    quiz: {
      question: 'A Dockerfile specifies FROM python:latest instead of a pinned version like python:3.12.4-slim. What risk does this introduce?',
      options: [
        { label: 'No risk — latest always points to the most stable, tested version', correct: false },
        { label: 'The exact same Dockerfile can produce a different underlying image at different points in time, as the "latest" tag\'s target changes — the same version-drift risk Section 1.2 warned about for Python dependencies', correct: true },
        { label: 'Docker will refuse to build an image using a floating tag', correct: false },
        { label: 'This only matters for multi-stage builds, not single-stage ones', correct: false },
      ],
      explanation: 'A floating tag like "latest" points to whatever the current latest version is at build time, which changes over time — building the identical Dockerfile at two different points in time can silently produce two different underlying images, undermining the reproducibility that\'s the entire point of containerization, and mirroring exactly the version-pinning discipline Section 1.2 recommends for Python dependencies themselves.',
    },
  },
  {
    id: '12.2',
    title: 'Testing AI Systems: Regression Sets and Evaluation Harnesses',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Standard software testing — unit tests for individual functions, integration tests for how components work together, API tests for endpoint behavior — all still apply directly to an AI application\'s non-AI code: request validation logic, database queries, authentication. What changes is that the AI-specific parts of the system (an LLM call, a retrieval result, an agent\'s decision) don\'t have a single deterministic "correct" output to assert against the way a typical unit test does.',
      'This is exactly why Sections 8.5 (RAG evaluation) and 9.6 (agent evaluation) built dedicated evaluation harnesses rather than relying on conventional unit tests for those components — a RAG or agent evaluation harness is, structurally, a specialized kind of regression test suite, just measuring recall/faithfulness/task-success instead of exact output equality, and this lesson connects that pattern explicitly to standard testing practice rather than treating it as something entirely separate.',
      'A well-organized AI application\'s test suite has layers matching this distinction: conventional unit and integration tests for the deterministic code (request validation, database logic, the rate limiter from Section 11.4 — these behave the same way every time and can be asserted against exactly); the evaluation harnesses from Sections 8.5 and 9.6 for the non-deterministic AI-driven behavior (retrieval quality, generation faithfulness, agent task success), run against a fixed evaluation dataset rather than asserting exact output equality.',
      'Running the evaluation harness as part of CI (Section 12.5) — not just manually, occasionally — is what actually catches a regression before it reaches production: a prompt change, a model version update, or a chunking strategy tweak can each silently degrade the system\'s behavior in ways that a human reviewer skimming a few examples by hand is unlikely to catch reliably, especially as the evaluation set grows beyond a handful of cases.',
      '<strong>Practical guidance:</strong> set an explicit threshold for the evaluation harness\'s key metrics (e.g. "retrieval recall must stay above 0.75," "task success rate must stay above 0.85") and fail the CI build if a change drops below it — this turns the evaluation harness from a passive reporting tool into an active merge gate, the same role conventional unit tests play for deterministic code.',
    ],
    keyPoints: [
      'Conventional unit/integration/API tests still apply directly to an AI application\'s non-AI-driven code (validation, database logic, rate limiting).',
      'AI-driven components (LLM calls, retrieval, agent decisions) don\'t have a single deterministic correct output — this is why Sections 8.5/9.6 built dedicated evaluation harnesses instead of relying on exact-output unit tests for those parts.',
      'A RAG/agent evaluation harness is structurally a specialized regression test suite, measuring metrics (recall, faithfulness, task success) instead of exact equality.',
      'Running the evaluation harness in CI, with an explicit threshold, turns it into an active merge gate — the same role conventional unit tests play for deterministic code.',
      'A prompt, model, or chunking-strategy change can silently degrade behavior in ways a human skimming a few examples is unlikely to catch reliably — automated, thresholded evaluation in CI is what actually catches this.',
    ],
    code: `import pytest

# --- Conventional unit test — deterministic code, exact assertions ---
def test_rate_limiter_blocks_after_threshold():
    limiter = RateLimiter(limit=5, window_seconds=60)
    for _ in range(5):
        assert limiter.allow("user_123") is True
    assert limiter.allow("user_123") is False   # 6th request within the window


# --- AI-specific "test" — actually an evaluation harness with a threshold,
# not a single exact-output assertion (Sections 8.5 and 9.6's pattern) ---
def test_rag_retrieval_recall_meets_threshold():
    eval_set = load_eval_set("eval_data/rag_eval_set.json")
    results = evaluate_retrieval(eval_set, vector_db, embed_model)  # Section 8.5

    MINIMUM_ACCEPTABLE_RECALL = 0.75
    assert results["avg_recall"] >= MINIMUM_ACCEPTABLE_RECALL, (
        f"Retrieval recall {results['avg_recall']:.2f} fell below the "
        f"{MINIMUM_ACCEPTABLE_RECALL} threshold — investigate before merging."
    )


def test_agent_task_success_meets_threshold():
    report = evaluate_agent(regression_suite, my_agent)  # Section 9.6

    MINIMUM_ACCEPTABLE_SUCCESS = 0.85
    assert report["task_success_rate"] >= MINIMUM_ACCEPTABLE_SUCCESS, (
        f"Agent task success {report['task_success_rate']:.0%} fell below "
        f"the {MINIMUM_ACCEPTABLE_SUCCESS:.0%} threshold."
    )

# Running "pytest" now runs BOTH the conventional unit test and the
# threshold-based evaluation harness checks together — both are merge
# gates in CI (Section 12.5), just measuring different kinds of correctness.
`,
    codeLabel: 'python',
    note: {
      label: 'WHEN TO USE',
      text: 'Treat the Section 8.5 and 9.6 evaluation harnesses as regression tests with an explicit numeric threshold, run in CI on every change — not as a manual, occasional health check.',
      tone: 'green',
    },
    quiz: {
      question: 'Why can\'t a RAG system\'s generation quality be tested the same way a typical function\'s return value is tested (assertEqual(actual, expected))?',
      options: [
        { label: 'RAG systems cannot be tested at all', correct: false },
        { label: 'An LLM\'s generated text is not deterministic in the same way a typical function\'s output is — evaluation instead measures metrics like recall and faithfulness against a threshold, across a representative evaluation set, rather than asserting exact output equality', correct: true },
        { label: 'pytest does not support testing any AI-related code', correct: false },
        { label: 'This is only true for agent systems, not RAG systems', correct: false },
      ],
      explanation: 'Because an LLM\'s output can vary even for the same input (and a "correct" answer can be phrased many different ways), asserting exact output equality the way a conventional unit test would doesn\'t work — the evaluation harnesses from Sections 8.5 and 9.6 instead measure quality metrics (recall, faithfulness, task success) across a representative set, compared against a threshold, which is a different but equally rigorous way of catching regressions.',
    },
  },
  {
    id: '12.3',
    title: 'Model Serving at Scale: vLLM, Triton & Quantization',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'Every LLM call in this course so far has gone through a hosted provider\'s API (Section 7.7\'s default recommendation) — this lesson covers what\'s actually involved on the other side of that API call, relevant both for understanding what a hosted provider is doing for you, and directly for teams that do choose to self-host an open-weight model per Section 7.7\'s criteria.',
      'Naively running a model for inference one request at a time badly underutilizes GPU hardware, which is built for massively parallel computation — <em>batching</em> groups multiple incoming requests together so the GPU processes them simultaneously rather than one at a time, dramatically improving throughput (total requests served per second) at some cost to individual-request latency, since a request might wait briefly for a batch to fill before processing begins.',
      'Dedicated model-serving frameworks like <em>vLLM</em> and <em>Triton Inference Server</em> exist specifically to handle this efficiently and automatically — vLLM in particular introduced <em>continuous batching</em> (dynamically adding new requests into an in-progress batch as earlier ones finish, rather than waiting for a whole batch to complete together) and efficient memory management for the attention mechanism\'s working memory (Section 6.2\'s Key/Value vectors, which must be kept in memory for every token in a generation, a significant memory cost that scales with context length), yielding substantially higher throughput than a naive serving setup.',
      '<em>Quantization</em> reduces the numerical precision used to store a model\'s weights (e.g. from 16-bit to 8-bit or 4-bit representations, the same technique behind QLoRA from Section 7.6) — this shrinks the model\'s memory footprint and can speed up inference, at a typically small but non-zero cost to output quality, making it possible to serve a given model on smaller or fewer GPUs than its full-precision version would require.',
      '<strong>Practical guidance:</strong> if you\'re calling a hosted API (Section 7.7\'s default), none of this is something you implement yourself — it\'s useful background for reasoning about a hosted provider\'s latency and pricing behavior, and becomes directly actionable engineering work only once self-hosting is the chosen path; this course covers it at the "know what these terms mean and what problem each solves" level rather than as a serving-infrastructure deep-dive.',
    ],
    keyPoints: [
      '<strong>Batching</strong> groups multiple requests for simultaneous GPU processing, dramatically improving throughput at some cost to individual-request latency.',
      '<strong>vLLM</strong> and <strong>Triton Inference Server</strong> are dedicated serving frameworks; vLLM\'s continuous batching and efficient attention-memory management yield substantially higher throughput than naive one-at-a-time serving.',
      'The Key/Value vectors from attention (Section 6.2) must be kept in memory throughout generation — a significant memory cost that scales with context length, which serving frameworks manage specifically to improve efficiency.',
      '<strong>Quantization</strong> reduces weight precision (e.g. 16-bit → 4-bit, the same technique underlying QLoRA from Section 7.6) to shrink memory footprint and speed up inference, at a typically small cost to output quality.',
      'This is background knowledge for reasoning about hosted-API behavior, and becomes directly actionable engineering work specifically once self-hosting (Section 7.7) is the chosen path.',
    ],
    code: `# Conceptual illustration of the throughput impact of batching — not a
# runnable vLLM/Triton deployment script, since actually operating these
# frameworks is outside this course's AI-engineering scope (Section 12.3's
# framing: know what these terms mean, not how to operate the infrastructure).

def naive_serving_throughput(requests_per_second_capacity_single, num_requests):
    # One request processed at a time — GPU parallelism is badly underutilized
    return num_requests / requests_per_second_capacity_single

def batched_serving_throughput(batch_size, batch_processing_time_seconds, num_requests):
    # Many requests processed simultaneously per batch
    num_batches = -(-num_requests // batch_size)  # ceiling division
    total_time = num_batches * batch_processing_time_seconds
    return num_requests / total_time


naive_time_estimate = 1000 / naive_serving_throughput(requests_per_second_capacity_single=2, num_requests=1000)
batched_throughput = batched_serving_throughput(batch_size=32, batch_processing_time_seconds=0.5, num_requests=1000)

print(f"naive: processes roughly 2 requests/sec")
print(f"batched (batch_size=32): processes roughly {batched_throughput:.1f} requests/sec")
# The magnitude of this gap is WHY dedicated serving frameworks like vLLM
# exist — naive one-at-a-time inference leaves most of a GPU's parallel
# compute capacity unused.
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    R1["Request 1"] --> B["Batched together"]
    R2["Request 2"] --> B
    R3["Request 3"] --> B
    B --> GPU["GPU processes batch in parallel"]
    GPU --> O1["Response 1"]
    GPU --> O2["Response 2"]
    GPU --> O3["Response 3"]`,
    note: {
      label: 'WHEN TO USE',
      text: 'This lesson\'s content becomes directly actionable specifically once Section 7.7\'s self-hosting criteria are met — for a hosted-API-based system (the default recommendation), this is background knowledge, not implementation work you\'ll do yourself.',
      tone: 'green',
    },
    quiz: {
      question: 'Why does batching improve throughput (total requests served per second) even though it can add slight latency to any individual request?',
      options: [
        { label: 'Batching has no real effect on throughput, only on latency', correct: false },
        { label: 'GPUs are built for massively parallel computation — processing several requests simultaneously in a batch uses that parallel capacity far more fully than processing one request at a time, even though an individual request might wait briefly for the batch to fill', correct: true },
        { label: 'Batching only works for classification models, not LLMs', correct: false },
        { label: 'Batching eliminates the need for quantization entirely', correct: false },
      ],
      explanation: 'A GPU processing a single request at a time leaves most of its parallel compute capacity idle — grouping multiple requests into a batch lets that capacity be used far more fully, which is why total throughput improves substantially even though an individual request might experience a small added wait for its batch to be ready for processing.',
    },
  },
  {
    id: '12.4',
    title: 'Monitoring, Drift Detection & Cost Tracking',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Section 9.7 covered tracing — deep, detailed visibility into one specific agent run, used for debugging a particular failure. Monitoring is the complementary discipline: aggregate, ongoing visibility into the system\'s overall health over time, used to notice that something has changed or is trending poorly before it becomes a specific incident someone reports.',
      'Core operational metrics to track continuously: request volume (has traffic changed unexpectedly), latency (per Section 3.3\'s guidance, track p50/p95/p99, not just an average, since a fine average can hide a degrading tail), error rate (both infrastructure errors and the AI-specific validation failures from Section 7.3), and token usage/cost (per Section 7.4\'s per-request logging, aggregated over time to spot trends rather than just individual outliers).',
      '<em>Model drift</em> and <em>data drift</em> describe a system\'s behavior or input data changing over time in ways that degrade performance even without any code change on your part: the kinds of questions users ask might shift (data drift), or a hosted model provider might update the model behind an API alias in ways that change its behavior (a direct instance of the version-drift risk flagged back in Section 1.2). Detecting this requires comparing current behavior against a historical baseline — a sudden shift in the evaluation harness\'s (Sections 8.5, 9.6) metrics between two points in time, run periodically rather than only on code changes, is a practical way to catch drift that isn\'t triggered by any deployment you made.',
      'Cost tracking at the monitoring level goes beyond Section 7.4\'s per-request logging to aggregate trends: cost per day/week, cost broken down by endpoint or feature, and cost per user (useful for identifying a small number of unusually expensive users or use cases) — this aggregate view is what turns the per-request logs from Section 11.3\'s <code>query_logs</code> table into an actionable operational signal rather than just raw data sitting in a database.',
      '<strong>Practical guidance:</strong> set up alerting on these metrics with thresholds tuned to your system\'s normal range (e.g. "alert if p95 latency exceeds 5 seconds" or "alert if daily cost exceeds $X"), rather than only looking at dashboards reactively after a person notices a problem — proactive alerting is what catches an issue during a quiet period (a weekend, an on-call gap) before it compounds.',
    ],
    keyPoints: [
      'Monitoring provides aggregate, ongoing visibility into system health over time — complementary to Section 9.7\'s tracing, which gives deep visibility into one specific run.',
      'Track p50/p95/p99 latency (not just average, per Section 3.3), error rate (including AI-specific validation failures from 7.3), request volume, and token usage/cost trends.',
      '<strong>Model/data drift</strong>: behavior degrading over time without any code change on your part — including a hosted provider updating a model behind an alias, directly connecting to Section 1.2\'s version-drift risk.',
      'Detect drift by periodically re-running the evaluation harnesses (Sections 8.5, 9.6) against a historical baseline, not only when code changes — drift can occur without any deployment.',
      'Set up proactive alerting on these metrics with tuned thresholds, rather than relying on dashboards being checked reactively after someone notices a problem.',
    ],
    code: `from datetime import datetime, timedelta

def compute_daily_metrics(query_logs_table, date: datetime) -> dict:
    day_start = date.replace(hour=0, minute=0, second=0)
    day_end = day_start + timedelta(days=1)
    rows = query_logs_table.query(created_at_between=(day_start, day_end))

    latencies = [r.latency_ms for r in rows]
    total_tokens = sum(r.input_tokens + r.output_tokens for r in rows)

    return {
        "request_count": len(rows),
        "p50_latency_ms": percentile(latencies, 50),
        "p95_latency_ms": percentile(latencies, 95),
        "p99_latency_ms": percentile(latencies, 99),
        "total_tokens": total_tokens,
        "estimated_cost": total_tokens / 1000 * COST_PER_1K_TOKENS,
    }


def check_for_drift(current_eval_results: dict, baseline_eval_results: dict, threshold: float = 0.05) -> bool:
    """Periodic check — run on a schedule, not just on code changes, since
    drift can occur without any deployment (e.g. a provider updating a
    model behind an alias, per Section 1.2's version-drift risk)."""
    recall_drop = baseline_eval_results["avg_recall"] - current_eval_results["avg_recall"]
    if recall_drop > threshold:
        alert_team(f"Retrieval recall dropped by {recall_drop:.2%} — possible drift detected.")
        return True
    return False


# --- Alerting, not just passive dashboarding ---
def check_alerts(daily_metrics: dict):
    if daily_metrics["p95_latency_ms"] > 5000:
        alert_team(f"p95 latency exceeded 5s: {daily_metrics['p95_latency_ms']}ms")
    if daily_metrics["estimated_cost"] > DAILY_COST_ALERT_THRESHOLD:
        alert_team(f"Daily cost exceeded threshold: \${daily_metrics['estimated_cost']:.2f}")
`,
    codeLabel: 'python',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Model drift can occur with zero code changes on your part — a hosted provider updating a model behind a "latest" alias is exactly the version-drift risk flagged back in Section 1.2, now showing up as a monitoring problem rather than a development-time one.',
      tone: 'green',
    },
    quiz: {
      question: 'A RAG system\'s retrieval recall, measured periodically against a fixed evaluation set, drops noticeably between two monitoring checks — but no code was deployed in between. What is a plausible explanation this lesson raises?',
      options: [
        { label: 'This cannot happen without a code deployment', correct: false },
        { label: 'The underlying data or model behavior may have drifted — for example, a hosted embedding or LLM provider updating a model behind an API alias, which is a direct instance of the version-drift risk raised in Section 1.2', correct: true },
        { label: 'The evaluation set itself must be broken if no code changed', correct: false },
        { label: 'This can only be explained by a database corruption issue', correct: false },
      ],
      explanation: 'Model or data drift can occur without any deployment on your end — a hosted provider changing what model actually sits behind a "latest" or unpinned alias is a concrete, realistic cause, and it\'s exactly why periodic evaluation-harness checks against a historical baseline matter, not just evaluation triggered by your own code changes.',
    },
  },
  {
    id: '12.5',
    title: 'Lab: CI/CD Pipeline for an AI Service',
    duration: '25 min',
    kind: 'assignment',
    summary: [
      'This lab sets up a complete CI/CD pipeline for the Section 11.6 FastAPI service, using the containerization (12.1) and testing (12.2) work from this section as its foundation — the goal is a pipeline that builds, tests (including the evaluation-harness merge gate), and deploys the service automatically on every change, rather than any of these steps being run manually.',
      'Build the pipeline in stages, matching a typical CI/CD tool\'s structure (GitHub Actions, GitLab CI, or similar): a <em>build</em> stage that builds the Docker image from Section 12.1\'s Dockerfile; a <em>test</em> stage that runs both the conventional unit tests and the thresholded evaluation harness checks from Section 12.2, failing the pipeline if either fails; and a <em>deploy</em> stage that pushes the built image to a registry and deploys it, gated on the test stage passing.',
      'The evaluation-harness merge gate is the piece most distinct from a typical CI/CD pipeline: configure the pipeline to run the Section 8.5/9.6 evaluation suites against a small, fast evaluation set (not the full production-scale dataset, to keep CI runtime reasonable) and block deployment if recall, faithfulness, or task success drops below the thresholds set in Section 12.2 — this is what actually prevents a prompt or chunking change that silently degrades quality from ever reaching production, rather than relying on someone noticing after the fact.',
      'For the write-up: describe what happens, end to end, when a developer pushes a code change — from the pipeline triggering, through build, test (including the evaluation gate), to deployment — and include a deliberate example where you introduce a regression (e.g. a prompt change likely to reduce faithfulness) and confirm the pipeline actually catches and blocks it, not just that the pipeline runs successfully on unchanged, working code.',
    ],
    keyPoints: [
      'Build a full pipeline: build (Docker, Section 12.1) → test (unit tests + evaluation-harness merge gate, Section 12.2) → deploy, gated on tests passing.',
      'The evaluation-harness merge gate is the AI-specific addition to a typical CI/CD pipeline — it blocks a change that silently degrades quality before it reaches production.',
      'Use a small, fast evaluation set for the CI gate to keep pipeline runtime reasonable, rather than the full production-scale evaluation dataset.',
      'Deliberately introduce a regression and confirm the pipeline actually catches and blocks it — verifying the gate works, not just that the pipeline runs on already-working code.',
      'This CI/CD pipeline is the deployment mechanism the Section 13 capstone assumes is already in place.',
    ],
    code: `# .github/workflows/ci-cd.yml — a representative CI/CD pipeline structure

name: CI/CD Pipeline

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t meridian-docs-api:\${{ github.sha }} .   # Section 12.1

  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run unit tests
        run: pytest tests/unit/
      - name: Run evaluation harness merge gate      # Section 12.2's pattern
        run: pytest tests/evaluation/ --eval-set=eval_data/ci_eval_set_small.json
        # This step FAILS the pipeline if recall, faithfulness, or task
        # success drops below the thresholds configured in Section 12.2 —
        # a genuine quality regression blocks deployment automatically.

  deploy:
    needs: test    # only runs if BOTH unit tests AND the evaluation gate passed
    runs-on: ubuntu-latest
    steps:
      - name: Push image to registry
        run: docker push meridian-docs-api:\${{ github.sha }}
      - name: Deploy to production
        run: ./scripts/deploy.sh meridian-docs-api:\${{ github.sha }}
`,
    codeLabel: 'yaml',
    mermaid: `flowchart LR
    P["Code pushed"] --> B["Build Docker image"]
    B --> T1["Run unit tests"]
    T1 --> T2["Run evaluation harness gate"]
    T2 -->|below threshold| BLOCK["Pipeline fails, deployment blocked"]
    T2 -->|meets threshold| D["Deploy to production"]`,
    note: {
      label: 'DECISION POINT',
      text: 'Deliberately test that your evaluation gate actually blocks a bad change — a pipeline that only ever runs against already-working code has never actually verified its gate works.',
      tone: 'green',
    },
    quiz: {
      question: 'A team sets up a CI/CD pipeline with an evaluation-harness gate, but has only ever tested it by pushing changes that don\'t affect quality. What haven\'t they actually verified?',
      options: [
        { label: 'Nothing — the pipeline running successfully proves the gate works correctly', correct: false },
        { label: 'Whether the gate would actually catch and block a genuine quality regression — this can only be confirmed by deliberately introducing one and observing the pipeline fail as expected', correct: true },
        { label: 'Whether the Docker image builds correctly', correct: false },
        { label: 'Whether the deployment script has correct permissions', correct: false },
      ],
      explanation: 'A pipeline that has only ever run against changes that don\'t degrade quality has never actually exercised its failure path — it\'s entirely possible for a merge gate to be silently misconfigured (e.g. checking the wrong metric, or a threshold set so low it never triggers) and still appear to be "working" simply because nothing has tested whether it would actually catch a real regression. Deliberately introducing one and confirming the pipeline blocks it is the only way to verify the gate functions as intended.',
    },
  },
]
