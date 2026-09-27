export default [
  {
    id: '13.1',
    title: 'Capstone Architecture: Assembling RAG, Agents & Serving Into One Platform',
    duration: '15 min',
    kind: 'theory',
    summary: [
      'The capstone is not new material — it\'s the integration of nearly every system built separately across this course into one coherent platform: the RAG pipeline (Section 8), the agent layer (Section 9), security hardening (Section 10), the FastAPI backend (Section 11), and the deployment pipeline (Section 12), combined into what this course has been calling, throughout, the Meridian Docs platform.',
      'The full architecture, as a single diagram: a user interacts through a web interface, which calls the FastAPI service (Section 11.1); requests route to either the RAG pipeline directly (for straightforward document questions, Section 8) or through the agent orchestrator (Section 9.5\'s LangGraph) for requests requiring tool use, calculation, or web search alongside retrieval; the agent layer can call the RAG retriever as one of its tools (Section 9.8\'s pattern), a calculator, and external search; retrieval itself uses hybrid search and reranking (Section 8.4) over a hybrid vector/relational store (Section 11.3\'s PostgreSQL plus a vector index); every request passes through authentication and rate limiting (Section 11.4) and security hardening against injection (Section 10.1) before reaching this core logic, and every request\'s outcome is logged (Section 11.3\'s <code>query_logs</code>) for the evaluation and monitoring work in the remaining capstone lessons.',
      'The key integration decision this lesson asks you to make explicitly, before writing any new code, is <em>routing</em>: when does a request go straight to RAG versus through the full agent orchestrator? A reasonable default is to route simple, single-document-lookup-style questions directly to RAG (faster, cheaper, per Section 7.4\'s cost guidance) and route requests that plausibly need multiple steps, calculation, or external information beyond the document store to the agent layer — this is the same model-routing-by-complexity idea from Section 7.4, applied to choosing a processing path rather than choosing a model size.',
      'Most of what makes this capstone "production" rather than merely "functional" is the connective tissue between these already-built pieces: consistent error handling across both the RAG-only and agent paths (Section 7.3, Section 11.2), consistent logging regardless of which path a request took (so Section 13.2\'s evaluation harness can measure both uniformly), and a single, coherent API surface (Section 11.1) that hides this internal routing decision from the client entirely.',
      '<strong>Practical guidance:</strong> before writing integration code, draw out your own version of this architecture diagram with your specific routing rule stated explicitly — this diagram, and the reasoning behind the routing decision, is exactly what Section 13.3\'s design-defense will ask you to explain and justify.',
    ],
    keyPoints: [
      'The capstone integrates, rather than newly builds: RAG (8), agents (9), security (10), backend (11), and deployment (12) into one platform.',
      'Key architectural decision: <strong>routing</strong> between a direct RAG path (simple lookups, faster/cheaper) and the full agent orchestrator path (multi-step, tool-requiring requests) — the same complexity-based routing idea from Section 7.4, applied to processing path instead of model size.',
      'What makes this "production" rather than merely functional is the connective tissue: consistent error handling and logging across both paths, and a single coherent API surface hiding the internal routing from clients.',
      'Every request passes through auth/rate-limiting (11.4) and injection hardening (10.1) regardless of which internal path it takes.',
      'Draw the architecture diagram and state the routing rule explicitly before writing integration code — this is exactly what the Section 13.3 design defense will ask you to justify.',
    ],
    code: `from fastapi import FastAPI, Depends
from pydantic import BaseModel

app = FastAPI(title="Meridian Docs — Production Platform")


class PlatformRequest(BaseModel):
    message: str
    conversation_id: int | None = None


def requires_agent_routing(message: str) -> bool:
    """The routing decision from this lesson — simple heuristic shown here;
    a more robust version could use a small, cheap classifier model,
    mirroring Section 7.4's model-routing pattern."""
    multi_step_indicators = ["calculate", "compare", "search the web", "and then", "also check"]
    return any(indicator in message.lower() for indicator in multi_step_indicators)


@app.post("/chat")
async def platform_chat(request: PlatformRequest, user_id: str = Depends(check_rate_limit)):  # 11.4
    if requires_agent_routing(request.message):
        # Full agent orchestration path — Section 9.5's LangGraph, Section 9.8's tools
        result = research_agent.invoke({"question": request.message, "findings": [],
                                          "remaining_subtasks": [request.message],
                                          "draft_report": "", "final_report": ""})
        answer, sources = result["final_report"], result.get("sources", [])
    else:
        # Direct RAG path — Section 8.6/10.4's hardened citation-aware system
        rag_result = answer_with_citations_hardened(request.message, vector_db, embed_model)
        answer, sources = rag_result["answer"], rag_result["sources"]

    # Uniform logging regardless of which path was taken — feeds Section 13.2's evaluation
    log_query(query_text=request.message, retrieved_chunk_ids=[s.get("source") for s in sources],
               path_taken="agent" if requires_agent_routing(request.message) else "rag", db=db)

    return {"answer": answer, "sources": sources}
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    U["User"] --> FA["FastAPI: auth + rate limit + injection hardening"]
    FA --> RT{"Routing: simple lookup or multi-step?"}
    RT -->|simple| RAG["Direct RAG path (Section 8)"]
    RT -->|multi-step| AG["Agent orchestrator (Section 9)"]
    AG --> RAG
    AG --> CALC["Calculator tool"]
    AG --> WEB["Web search tool"]
    RAG --> VDB["Hybrid vector + relational store"]
    RAG --> LOG["query_logs (uniform across both paths)"]
    AG --> LOG`,
    note: {
      label: 'DECISION POINT',
      text: 'State your routing rule explicitly and be ready to defend it — "why does this request go to RAG directly instead of the agent?" is exactly the kind of question Section 13.3 will ask about your specific system.',
      tone: 'green',
    },
    quiz: {
      question: 'Why does the capstone architecture route simple, single-document-lookup questions directly to RAG rather than always through the full agent orchestrator?',
      options: [
        { label: 'The agent orchestrator cannot handle simple questions at all', correct: false },
        { label: 'Routing simple requests directly to RAG is faster and cheaper (Section 7.4\'s cost guidance), reserving the agent orchestrator\'s added latency and token cost for requests that genuinely need multi-step reasoning or tool use', correct: true },
        { label: 'RAG and agents cannot be used within the same application', correct: false },
        { label: 'This routing decision has no effect on cost or latency', correct: false },
      ],
      explanation: 'The agent orchestrator adds real overhead — planning, potentially multiple tool calls, more tokens — that\'s unnecessary for a question a single retrieval-and-generate pass can already answer well. Routing by complexity, the same principle behind Section 7.4\'s model-size routing, reserves that overhead for requests that actually need it, keeping the common case fast and cheap.',
    },
  },
  {
    id: '13.2',
    title: 'Building the Evaluation Harness and Test Dataset',
    duration: '15 min',
    kind: 'assignment',
    summary: [
      'This lesson extends the evaluation harnesses from Sections 8.5 and 9.6 to cover the whole integrated platform from 13.1, rather than the RAG and agent components separately — measuring the system a user actually interacts with, including the routing decision itself.',
      'Build an evaluation dataset covering both paths from 13.1\'s routing: a set of straightforward document-lookup questions (expected to route to RAG) and a set of genuinely multi-step questions (expected to route to the agent), each with an expected answer and, where applicable, expected source documents or expected tool-call sequences — reusing the dataset formats from Sections 8.5 and 9.6, now unified into one evaluation set spanning the whole platform.',
      'Measure four categories end to end: <em>retrieval quality</em> (recall, MRR, per 8.5) on the RAG-routed questions; <em>answer quality</em> (faithfulness, relevance, per 8.5, and task success/tool-call correctness, per 9.6) across both paths; <em>latency</em> (p50/p95/p99, per Section 12.4\'s monitoring guidance) — measured separately for the RAG path and the agent path, since they have meaningfully different expected latency profiles per 13.1\'s routing rationale; and <em>cost</em> (token usage per request, per Section 7.4), similarly broken down by path.',
      'A distinct and easy-to-miss evaluation dimension specific to this integrated system: <em>routing accuracy</em> — for each test question, did the system route it to the path you actually expected (RAG vs. agent)? A routing mistake (a simple question unnecessarily routed to the slower, more expensive agent path, or a genuinely multi-step question incorrectly handled by RAG alone and given an incomplete answer) is its own failure mode, separate from retrieval quality or generation quality, and worth measuring explicitly rather than only noticing indirectly through a degraded answer-quality score.',
      '<strong>Practical guidance:</strong> wire this evaluation harness into the CI/CD pipeline from Section 12.5 exactly as that lesson describes, with explicit thresholds for each of these four categories plus routing accuracy — this is the merge gate that protects the integrated capstone platform the same way Section 12.5\'s gate protected the standalone service.',
    ],
    keyPoints: [
      'Extends Sections 8.5 (RAG evaluation) and 9.6 (agent evaluation) to the whole integrated 13.1 platform, including the routing decision itself.',
      'Build a unified evaluation dataset spanning both routing paths: simple lookup questions (expected → RAG) and multi-step questions (expected → agent).',
      'Measure four categories: retrieval quality, answer quality (faithfulness/relevance/task success), latency (broken down by path, given their different expected profiles), and cost.',
      '<strong>Routing accuracy</strong> is a distinct failure mode specific to this integrated system — a question routed to the wrong path is a different problem from a retrieval or generation quality issue, and should be measured explicitly.',
      'Wire this harness into the Section 12.5 CI/CD pipeline as the capstone\'s merge gate, with explicit thresholds for all measured categories.',
    ],
    code: `from dataclasses import dataclass

@dataclass
class PlatformTestCase:
    question: str
    expected_path: str          # "rag" or "agent"
    expected_answer_contains: str
    expected_source_ids: list[str] | None = None       # for RAG-routed cases
    expected_tool_sequence: list[str] | None = None     # for agent-routed cases


def evaluate_platform(test_cases: list[PlatformTestCase], platform_client) -> dict:
    results = {"routing_correct": 0, "task_success": 0, "latencies_by_path": {"rag": [], "agent": []}}

    for case in test_cases:
        start = time.time()
        response = platform_client.chat(case.question)
        latency_ms = (time.time() - start) * 1000

        actual_path = response["path_taken"]
        results["latencies_by_path"][actual_path].append(latency_ms)

        if actual_path == case.expected_path:
            results["routing_correct"] += 1

        answer_ok = case.expected_answer_contains.lower() in response["answer"].lower()
        if answer_ok:
            results["task_success"] += 1

    n = len(test_cases)
    return {
        "routing_accuracy": results["routing_correct"] / n,
        "task_success_rate": results["task_success"] / n,
        "rag_p95_latency_ms": percentile(results["latencies_by_path"]["rag"], 95),
        "agent_p95_latency_ms": percentile(results["latencies_by_path"]["agent"], 95),
    }


# --- CI merge gate thresholds, per Section 12.5's pattern, extended for the capstone ---
CAPSTONE_THRESHOLDS = {
    "routing_accuracy": 0.90,
    "task_success_rate": 0.85,
    "rag_p95_latency_ms": 800,     # RAG path expected to be fast
    "agent_p95_latency_ms": 6000,  # agent path expected to be slower — different threshold
}
`,
    codeLabel: 'python',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'A misrouted request is a distinct failure mode from a retrieval or generation error — measuring routing accuracy explicitly catches "this simple question unnecessarily went through the slow agent path" before it only shows up indirectly as a vague cost or latency complaint.',
      tone: 'green',
    },
    quiz: {
      question: 'Why does the capstone evaluation harness set different p95 latency thresholds for the RAG-routed path versus the agent-routed path, rather than one threshold for the whole system?',
      options: [
        { label: 'This is a mistake — a single system should have exactly one latency threshold regardless of internal routing', correct: false },
        { label: 'The two paths have meaningfully different expected latency profiles by design (Section 13.1\'s routing rationale) — a single shared threshold would either be too strict for the agent path or too lax for the RAG path', correct: true },
        { label: 'FastAPI requires separate thresholds for each endpoint', correct: false },
        { label: 'Latency cannot be measured separately for different internal code paths', correct: false },
      ],
      explanation: 'Section 13.1\'s routing decision deliberately sends simple requests through a faster path and complex requests through a necessarily slower, more thorough agent path — treating both with the same latency expectation would either falsely flag the agent path as too slow (when that\'s expected given what it does) or fail to catch a genuine regression in the RAG path (if the shared threshold were set loose enough to accommodate the agent path). Separate, appropriately-calibrated thresholds reflect the system\'s actual intended behavior.',
    },
  },
  {
    id: '13.3',
    title: 'Defending Your System: Answering the Hard Design Questions',
    duration: '15 min',
    kind: 'theory',
    summary: [
      'A working system and a defensible system are different achievements — this lesson is not about writing more code, but about being able to explain and justify every major design decision made across this course when questioned, which is the actual bar a production system (and a technical interview about one) is held to.',
      'Prepare specific, non-generic answers — grounded in your actual system, not textbook definitions — for each of these questions: <strong>Why RAG instead of fine-tuning?</strong> (Section 8.1 versus 7.6 — your answer should reference the frequently-changing nature of your specific document set, not just repeat the general principle); <strong>Why this embedding model and chunk size?</strong> (Sections 6.4, 8.2 — ideally backed by your actual evaluation results from 13.2 showing what you tried and why the current choice measured better); <strong>How do you know your RAG works?</strong> (point directly to your 13.2 evaluation harness\'s specific recall/faithfulness numbers, not a general description of "we tested it").',
      'Continue with: <strong>What happens at 10 million documents?</strong> (reference Section 8.3\'s ANN/HNSW discussion — your current setup\'s bottleneck, and what would need to change: sharding the vector index, adjusting the <code>ef_search</code> speed/accuracy trade-off, or reconsidering chunk granularity to manage overall vector count); <strong>How would you halve LLM cost?</strong> (reference Section 7.4\'s levers — model routing to cheaper models for simpler requests, prompt caching for repeated context, more aggressive reranking to reduce how much context reaches the LLM in the first place); <strong>Why is retrieval sometimes slow?</strong> (reference Section 8.3\'s ANN parameters and Section 8.4\'s reranking cost specifically, not a vague "the database is slow").',
      'Finish with the security and reliability questions: <strong>How do you defend against prompt injection?</strong> (Section 10.1\'s privilege-separation pattern, plus your 10.4 lab\'s actual demonstrated before/after attack results — a concrete demonstration is a much stronger answer than a description of the general technique); <strong>What happens if the LLM returns invalid JSON?</strong> (Section 7.3\'s bounded retry-with-validation-error pattern, specifically); <strong>How do you deploy this system?</strong> (Section 12\'s containerization, CI/CD, and evaluation-gated pipeline, described as your specific pipeline\'s actual stages, not a generic description of CI/CD).',
      '<strong>Practical guidance:</strong> for every answer, prefer citing a specific number, test result, or concrete decision from your own system over a general statement of the underlying principle — "our evaluation harness measured 0.82 recall before reranking and 0.91 after, which is why we added it" is a categorically stronger answer than "reranking generally improves retrieval quality," even though both are true.',
    ],
    keyPoints: [
      'A defensible system requires being able to justify every major decision with specifics from your own system — not just restate the general principle behind it.',
      'Ground each answer in your actual evaluation numbers (13.2), your actual demonstrated attack/defense results (10.4), and your actual architecture decisions (13.1), not textbook descriptions.',
      'The full question set spans architecture (RAG vs. fine-tuning), retrieval design (embedding model, chunk size, scaling to 10M documents), cost, latency, security (injection defense), reliability (malformed output), and deployment.',
      'A specific number or concrete test result is a categorically stronger answer than a correct but generic statement of the underlying principle.',
      'This lesson produces no new code — it is preparation for exactly the kind of scrutiny a real production system, or a technical interview about one, is held to.',
    ],
    code: `# This lesson has no code artifact — instead, prepare written, specific
# answers to each question below, grounded in YOUR system's actual
# numbers and decisions. A structure for that preparation:

DESIGN_DEFENSE_PREP = {
    "Why RAG over fine-tuning?": (
        "Cite: how often your document set changes (Section 8.1 vs 7.6's "
        "frequently-changing-knowledge argument) — with a specific example."
    ),
    "Why this embedding model and chunk size?": (
        "Cite: your actual 13.2 evaluation results comparing at least two "
        "configurations, with the specific recall/MRR numbers that decided it."
    ),
    "How do you know your RAG works?": (
        "Cite: your evaluation harness's specific recall, faithfulness, and "
        "task success numbers (13.2) — not a general description of testing."
    ),
    "What happens at 10 million documents?": (
        "Cite: Section 8.3's ANN trade-offs — specifically, what you'd adjust "
        "(ef_search, sharding, chunk granularity) and why."
    ),
    "How would you halve LLM cost?": (
        "Cite: Section 7.4's specific levers (model routing, caching, tighter "
        "reranking) as applied to YOUR system's actual cost breakdown."
    ),
    "Why is retrieval sometimes slow?": (
        "Cite: Section 8.3's ANN parameters and 8.4's reranking cost, applied "
        "to your system's specific latency measurements from 13.2."
    ),
    "How do you defend against prompt injection?": (
        "Cite: Section 10.1's privilege separation AND your 10.4 lab's actual "
        "before/after demonstrated attack results."
    ),
    "What happens if the LLM returns invalid JSON?": (
        "Cite: Section 7.3's specific bounded retry-with-validation-error pattern."
    ),
    "How do you deploy this system?": (
        "Cite: your ACTUAL Section 12 pipeline stages — build, test, evaluation "
        "gate, deploy — described concretely, not generically."
    ),
}
`,
    codeLabel: 'python',
    note: {
      label: 'KEY INSIGHT',
      text: 'A specific evaluation number ("0.82 recall before reranking, 0.91 after") is a categorically stronger answer than a correct general statement ("reranking improves retrieval quality") — prepare the former for every question on this list.',
      tone: 'green',
    },
    quiz: {
      question: 'When asked "how do you know your RAG system works?" during a design review, which response better satisfies this lesson\'s guidance?',
      options: [
        { label: '"We tested it thoroughly and it performs well in our experience."', correct: false },
        { label: '"Our evaluation harness measures 0.87 retrieval recall and 0.91 faithfulness on a 40-question test set spanning both routing paths, run as a CI merge gate."', correct: true },
        { label: '"RAG systems are generally known to reduce hallucination compared to base LLMs."', correct: false },
        { label: '"We haven\'t measured this formally but users haven\'t complained."', correct: false },
      ],
      explanation: 'This lesson\'s core guidance is to prefer a specific, concrete result from your own system\'s actual evaluation over a general statement about RAG systems or an informal impression — citing exact metrics, the test set\'s scope, and that it runs as an automated CI gate demonstrates genuine, verifiable knowledge of the system\'s behavior rather than a vague assurance.',
    },
  },
  {
    id: '13.4',
    title: 'Lab: Shipping the Production AI Knowledge Platform',
    duration: '40 min',
    kind: 'assignment',
    summary: [
      'This is the final lab of the course and the fifth flagship portfolio project: integrating every major piece built across Sections 8 through 12 into one deployed system, following the architecture from 13.1, measured by the evaluation harness from 13.2, and defensible per 13.3\'s preparation.',
      'Assemble, in order: the hybrid RAG retriever (Sections 8.2–8.4) behind the routing logic from 13.1; the agent layer (Section 9) wired in as the alternate path with at least the three tools from 9.8 (search, calculator, RAG retrieval); security hardening from Section 10 applied to both paths uniformly (privilege-separated prompts, PII handling on ingestion, moderation on input and output); the full FastAPI service from Section 11 (authentication, rate limiting, PostgreSQL persistence, and at minimum the non-streaming <code>/chat</code> endpoint); and the containerization plus CI/CD pipeline from Section 12, with the Section 13.2 evaluation harness wired in as an actual merge gate, not just a manually-run script.',
      'Required capstone features, restated concretely against what you\'ve already built: multi-format document ingestion (Section 8.2\'s chunking applied to at least PDF and plain text, extending 8.6\'s PDF-only scope); hybrid retrieval with metadata filtering and reranking (8.4); citations on every RAG-path answer (8.6, 10.4\'s hardened version); an agent that genuinely chooses among multiple tools per request rather than always taking the same path (9.8); the full API, database, and vector store (11); full containerization (12.1); and the evaluation harness with monitoring (12.4, 13.2) covering both routing paths.',
      'Deploy the system somewhere it can actually be reached — even a modest, low-traffic hosting setup counts, since the point is demonstrating the full pipeline (Section 12.5) actually running end to end, not achieving production-grade scale. For the final write-up, treat Section 13.3\'s question list as a literal checklist: write a specific, grounded answer to each one, citing your own system\'s actual numbers, architecture decisions, and demonstrated test results — this write-up, together with the deployed system and its evaluation results, is the complete deliverable for this course.',
    ],
    keyPoints: [
      'The fifth and final flagship portfolio project — integrates RAG, agents, security, backend, and MLOps/deployment (Sections 8-12) into one deployed system.',
      'Required features: multi-format ingestion, hybrid retrieval with reranking, citations, a genuinely multi-tool-choosing agent, full API/database/vector store, containerization, and an evaluation harness wired in as a real CI merge gate.',
      'Deploy the system somewhere actually reachable — modest scale is fine; the point is demonstrating the full Section 12.5 pipeline running end to end.',
      'The final write-up answers Section 13.3\'s full design-defense question list concretely, citing this specific system\'s numbers and decisions.',
      'The deployed system, its evaluation results, and this write-up together are the complete deliverable for the entire 24-week/13-section course.',
    ],
    code: `# This lab's "code" is the integration of nearly everything built across
# Sections 8-12 — the skeleton below shows how the major pieces connect,
# not a new component to build from scratch.

from fastapi import FastAPI, Depends
app = FastAPI(title="Meridian Docs — Capstone Platform")

@app.post("/chat")
async def capstone_chat(request: PlatformRequest, user_id: str = Depends(check_rate_limit)):  # 11.4
    # Input moderation + injection-aware handling (Section 10)
    if moderate_input(request.message)["flagged"]:
        return {"answer": "This request can't be processed."}

    # Routing decision (13.1)
    if requires_agent_routing(request.message):
        result = research_agent.invoke({"question": request.message, ...})  # Section 9
        answer, sources, path = result["final_report"], result.get("sources", []), "agent"
    else:
        rag_result = answer_with_citations_hardened(request.message, vector_db, embed_model)  # 8.6, 10.4
        answer, sources, path = rag_result["answer"], rag_result["sources"], "rag"

    # Output moderation (Section 10.3)
    if moderate_input(answer)["flagged"]:
        return {"answer": "Unable to generate an appropriate response."}

    # Persistence + logging (Section 11.3) — feeds monitoring (12.4) and evaluation (13.2)
    save_message(request.conversation_id, role="assistant", content=answer, db=db)
    log_query(query_text=request.message, path_taken=path,
               retrieved_chunk_ids=[s.get("source") for s in sources], db=db)

    return {"answer": answer, "sources": sources, "path": path}

@app.get("/health")
async def health_check():
    return {"status": "ok", "database": check_database_connection(db),
             "vector_db": check_vector_db_connection(vector_db)}

# Deployed via the Section 12.1 Dockerfile and the Section 12.5 CI/CD pipeline,
# with the Section 13.2 evaluation harness wired in as that pipeline's merge gate.
`,
    codeLabel: 'python',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'This capstone is not new material — it is proof that every piece built separately across this course (RAG, agents, security, backend, MLOps) actually composes into one coherent, evaluated, deployed system, which is the whole point of the "AI engineer" role as framed back in Lesson 1.1.',
      tone: 'green',
    },
    quiz: {
      question: 'What distinguishes the capstone lab from all the section-level labs earlier in this course (8.6, 9.8, 10.4, 11.6, 12.5)?',
      options: [
        { label: 'It introduces entirely new concepts not covered in any earlier lesson', correct: false },
        { label: 'It integrates the components built separately across those earlier labs into one coherent, routed, evaluated, and deployed platform, rather than building any single new capability in isolation', correct: true },
        { label: 'It only covers material from Section 13 itself', correct: false },
        { label: 'It replaces the need for the evaluation harness built in earlier sections', correct: false },
      ],
      explanation: 'Every technical capability in the capstone was already built in an earlier lab — RAG (8.6), the agent (9.8), security hardening (10.4), the API/database (11.6), and the CI/CD pipeline (12.5). The capstone\'s actual work is integration: routing between components, applying security and logging uniformly across both paths, and proving the whole assembled system holds up under the same evaluation and deployment rigor as its individual pieces — exactly the "design, build, evaluate, deploy, and explain an AI system" outcome this course set out to reach back in Lesson 1.1.',
    },
  },
]
