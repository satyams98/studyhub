export default [
  {
    id: '11.1',
    title: 'Designing REST APIs for AI Applications With FastAPI',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Everything built through Sections 8-10 — RAG pipelines, agents, security hardening — exists as Python functions and scripts so far. This section wraps that logic in a real backend service that a frontend, another system, or an external user can actually call, using FastAPI, a modern Python web framework well suited to AI applications specifically because of its native async support (useful given how much of an AI backend\'s time is spent waiting on LLM API calls) and its tight integration with Pydantic for request/response validation.',
      'A typical AI application\'s API surface follows a recognizable shape across most products in this space: a <code>/chat</code> endpoint for conversational interaction, an <code>/upload</code> endpoint for document ingestion (feeding the Section 8 pipeline), a <code>/search</code> endpoint for direct retrieval without generation, a <code>/documents</code> endpoint for listing/managing ingested content, and a <code>/health</code> endpoint for infrastructure monitoring (used again in Section 12\'s deployment pipeline). Defining these clearly and consistently upfront makes the rest of this section\'s lessons compose cleanly onto a shared foundation.',
      'FastAPI\'s route decorators (<code>@app.post(...)</code>) combined with Pydantic models for request and response bodies give you both automatic request validation (Section 11.2 covers this in depth) and automatically-generated interactive API documentation — a genuinely useful side effect for a team integrating a frontend against a backend that\'s still under active development.',
      'Route design for an AI application benefits from separating "fast" and "slow" endpoints explicitly in how they\'re structured: a <code>/search</code> endpoint (retrieval only, no generation) typically responds in tens to low hundreds of milliseconds, while a <code>/chat</code> endpoint (retrieval plus LLM generation) can take several seconds — designing these as separate endpoints rather than one endpoint with a "mode" parameter makes each one\'s expected latency and client-side handling (e.g. loading states) explicit rather than implicit.',
      '<strong>Practical guidance:</strong> resist the temptation to expose internal implementation details (which vector database, which embedding model, internal document IDs) directly through the API\'s response shape — keep the API contract stable and focused on what the client actually needs, so that Section 8\'s internal RAG implementation can evolve (a different chunking strategy, a swapped vector database) without breaking every client that depends on this API.',
    ],
    keyPoints: [
      'FastAPI suits AI applications well due to native async support (useful for LLM-call-heavy workloads) and tight Pydantic integration for validation.',
      'A recognizable API shape across most AI products: <code>/chat</code>, <code>/upload</code>, <code>/search</code>, <code>/documents</code>, <code>/health</code>.',
      'Route decorators plus Pydantic request/response models give automatic validation and automatically-generated interactive API documentation.',
      'Separate fast endpoints (retrieval-only, tens-to-hundreds of milliseconds) from slow ones (retrieval plus generation, several seconds) as distinct routes rather than one parameterized endpoint.',
      'Keep the API\'s response shape focused on what clients need, not internal implementation details — this lets the underlying RAG/agent implementation evolve without breaking client integrations.',
    ],
    code: `from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Meridian Docs API")


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

class SearchResult(BaseModel):
    text: str
    source: str
    score: float

class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None

class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/search", response_model=list[SearchResult])
async def search(request: SearchRequest):
    """Fast, retrieval-only endpoint — no LLM generation involved."""
    results = vector_db.similarity_search(embed_model.embed(request.query), top_k=request.top_k)
    return [SearchResult(text=r.text, source=r.metadata["source"], score=r.score) for r in results]


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Slower endpoint — retrieval PLUS LLM generation, per Section 8.6."""
    result = answer_with_citations(request.message, vector_db, embed_model)
    return ChatResponse(answer=result["answer"], sources=result["sources"])


@app.post("/upload")
async def upload_document(file_path: str):
    """Feeds the Section 8 ingestion pipeline."""
    chunks = extract_pdf_chunks(file_path)
    embed_and_store(chunks, vector_db, embed_model)
    return {"status": "ingested", "chunk_count": len(chunks)}
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    C["Client"] --> H["/health (infra monitoring)"]
    C --> S["/search (fast, retrieval-only)"]
    C --> CH["/chat (slower, retrieval + generation)"]
    C --> U["/upload (ingestion pipeline)"]
    C --> D["/documents (management)"]`,
    note: {
      label: 'WHEN TO USE',
      text: 'Keep /search and /chat as separate endpoints rather than one endpoint with a "generate: true/false" flag — this makes each endpoint\'s expected latency explicit to any client integrating against the API.',
      tone: 'green',
    },
    quiz: {
      question: 'A team considers combining /search and /chat into a single endpoint with an optional "generate_answer: bool" parameter. What downside does this lesson suggest with that design?',
      options: [
        { label: 'FastAPI does not support optional boolean parameters', correct: false },
        { label: 'It obscures the very different expected latency of a retrieval-only call versus a retrieval-plus-generation call, making client-side handling (like loading states) harder to design correctly', correct: true },
        { label: 'Combining endpoints always violates REST principles and is never acceptable', correct: false },
        { label: 'Pydantic cannot validate a request containing a boolean field', correct: false },
      ],
      explanation: 'A retrieval-only request typically returns in tens to low hundreds of milliseconds, while adding LLM generation can take several seconds — collapsing both into one endpoint with a flag hides this difference from the client, whereas separate, purpose-specific endpoints make each one\'s expected latency and appropriate client-side handling explicit and easy to reason about.',
    },
  },
  {
    id: '11.2',
    title: 'Request Validation, Async Handlers & Error Responses',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Pydantic models used as FastAPI request bodies (11.1) provide automatic validation before your handler code ever runs: a request missing a required field, or with a field of the wrong type, is rejected with a structured error response automatically, without your handler needing to write manual validation logic for basic structural correctness.',
      'This is the same schema-validation principle from Section 7.2 (validating LLM output), applied at the API boundary instead — and worth combining explicitly for an AI endpoint: validate the incoming request structure with Pydantic (this lesson), and separately validate the LLM\'s output structure before returning it in the response (Section 7.2\'s pattern), since these are two distinct validation boundaries that can each fail independently.',
      '<code>async def</code> handlers let FastAPI serve other requests while one request is waiting on a slow I/O operation (an LLM API call, a database query) rather than blocking the entire server on that one wait — this matters disproportionately for AI applications specifically, since LLM calls (seconds) are far slower than typical database queries (milliseconds), so a synchronous handler design would let a single slow LLM call block many other users\' unrelated requests.',
      'Consistent error response design matters for any API, but an AI backend has failure modes beyond typical HTTP errors: a well-designed error response distinguishes between a client error (bad request structure — <code>422</code>), an upstream service failure (the LLM provider is down or rate-limited — often surfaced as a <code>503</code> with a retry-after hint, connecting to the reliability patterns from Section 7.3), and a validation failure specific to AI output (the LLM\'s response failed schema validation even after the reliability layer\'s retries were exhausted — worth its own distinct error code and message, not lumped in with a generic <code>500</code>).',
      '<strong>Practical guidance:</strong> wrap Section 7.3\'s reliability logic (timeouts, bounded retries, fallback) inside the FastAPI handler itself, and translate its outcomes into these distinct HTTP status codes and structured error bodies — this is what lets a client (or another team\'s integration) programmatically distinguish "retry this request later" from "this request was malformed and retrying won\'t help," the same retryable-versus-non-retryable distinction from Section 7.3, now expressed at the API contract level.',
    ],
    keyPoints: [
      'Pydantic request models provide automatic structural validation at the API boundary — the same schema-validation principle as Section 7.2, applied to incoming requests rather than LLM output.',
      '<code>async def</code> handlers let FastAPI serve other requests during slow I/O waits (LLM calls, DB queries) — disproportionately important for AI backends given how slow LLM calls are relative to typical database queries.',
      'Distinguish error types explicitly: client errors (422), upstream/LLM-provider failures (503, often with a retry hint), and AI-specific output-validation failures after retries are exhausted (a distinct error, not a generic 500).',
      'Wrap Section 7.3\'s reliability logic (timeout, bounded retry, fallback) inside the handler and translate its outcomes into these distinct HTTP status codes.',
      'This lets clients programmatically distinguish "retry later" from "malformed request, retrying won\'t help" — the same distinction Section 7.3 makes internally, now exposed at the API contract level.',
    ],
    code: `from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError

app = FastAPI()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: str | None = None
    # Pydantic rejects a request with an empty message or missing field
    # automatically, before this handler's code ever runs.


@app.post("/chat")
async def chat(request: ChatRequest):   # async def — doesn't block other requests during the LLM call
    try:
        result = await call_llm_with_reliability(request.message)  # Section 7.3's pattern, made async
        return {"answer": result.answer, "sources": result.sources}

    except LLMProviderUnavailable as e:
        # Upstream failure — distinct from a client error, includes a retry hint
        raise HTTPException(
            status_code=503,
            detail={"error": "llm_provider_unavailable", "retry_after_seconds": 30},
        )

    except OutputValidationExhausted as e:
        # AI-specific: retries were exhausted per Section 7.3, output still invalid.
        # Distinct from a generic 500 — this is a known, specific failure mode.
        raise HTTPException(
            status_code=422,
            detail={"error": "llm_output_validation_failed", "attempts": e.attempts},
        )

    except Exception as e:
        # Genuinely unexpected — logged distinctly from the known failure modes above
        log_unexpected_error(e)
        raise HTTPException(status_code=500, detail={"error": "internal_error"})
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    R["Incoming request"] --> V{"Pydantic validation"}
    V -->|fails| E1["422: malformed request"]
    V -->|passes| H["async handler: call LLM (Section 7.3 reliability)"]
    H -->|upstream failure| E2["503: retry after N seconds"]
    H -->|output validation exhausted| E3["422: AI-specific validation failure"]
    H -->|success| S["200: valid response"]`,
    note: {
      label: 'WHY THIS MATTERS',
      text: 'A synchronous (non-async) handler blocking on a several-second LLM call would prevent the server from handling any other request during that wait — async handlers are what let one slow LLM call not degrade every other user\'s experience.',
      tone: 'green',
    },
    quiz: {
      question: 'An API endpoint uses a synchronous (non-async) handler that calls an LLM taking 4 seconds to respond. What happens to other incoming requests during that 4-second wait, compared to if the handler were async?',
      options: [
        { label: 'There is no difference — FastAPI handles all requests identically regardless of async', correct: false },
        { label: 'With a synchronous handler, the server can be blocked from handling other requests during that wait, whereas an async handler lets the server serve other requests concurrently during the same wait', correct: true },
        { label: 'Synchronous handlers are always faster than async ones for LLM calls', correct: false },
        { label: 'This only matters for the /upload endpoint, not /chat', correct: false },
      ],
      explanation: 'The whole point of async handlers in a framework like FastAPI is to free up the server to handle other requests while one request is waiting on slow I/O (like an LLM API call) rather than blocking — a synchronous handler holds up that capacity for the full duration of the wait, which is disproportionately costly for AI backends given how much longer LLM calls take than typical database queries.',
    },
    crossRefs: ['7.2', '7.3', '11.1'],
  },
  {
    id: '11.3',
    title: 'Persisting Application State With PostgreSQL',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'An AI application needs to persist more than the vector database (Section 8.3) covers: conversation history, uploaded document metadata, user accounts, and query logs (useful for both the evaluation work in Section 8.5/9.6 and cost tracking from Section 7.4) all belong in a conventional relational database — PostgreSQL is a natural choice here partly because <code>pgvector</code>, an extension adding vector similarity search directly to Postgres, means a single database can sometimes cover both the relational and vector-storage needs of a smaller-scale application, avoiding the operational overhead of running two separate database systems.',
      'A reasonable core schema for this course\'s recurring "Meridian Docs" domain: a <code>documents</code> table (id, source, upload metadata), a <code>conversations</code> table (id, user_id, created_at), a <code>messages</code> table (conversation_id foreign key, role, content, created_at) for chat history, and a <code>query_logs</code> table (timestamp, query text, retrieved chunk IDs, token counts, latency) — this last table directly feeds the cost-tracking (7.4) and evaluation (8.5, 9.6) work from earlier sections, so it\'s worth designing deliberately rather than as an afterthought.',
      'Standard relational database fundamentals apply exactly as they would for any application: primary keys uniquely identify a row, foreign keys enforce that a message can\'t reference a nonexistent conversation, indexes speed up common lookups (e.g. an index on <code>conversation_id</code> for quickly fetching a conversation\'s message history), and transactions ensure a multi-step write (e.g. inserting a message and updating the conversation\'s <code>last_updated</code> timestamp together) either fully succeeds or fully rolls back, never leaving the database in a half-updated state.',
      'One AI-specific schema consideration: since LLM responses and retrieved context can be large and are logged for evaluation/debugging purposes (Section 9.7\'s tracing), consider whether every field needs to live in the primary, frequently-queried tables versus a separate, larger "trace" or "log" table that\'s written to but rarely joined against in normal application queries — mixing large trace payloads into frequently-queried tables can slow down otherwise-simple queries as that data grows.',
      '<strong>Practical guidance:</strong> the <code>query_logs</code> table design from this lesson is exactly the data source the Section 13.2 capstone evaluation harness reads from — designing it with clear, well-indexed fields now (rather than retrofitting logging later, echoing Section 9.7\'s "instrument before you need it" advice) pays off directly there.',
    ],
    keyPoints: [
      'PostgreSQL (optionally with the <code>pgvector</code> extension) can cover both conventional relational data and vector storage for smaller-scale applications, avoiding running two separate database systems.',
      'Core schema for an AI application: <code>documents</code>, <code>conversations</code>, <code>messages</code>, and a <code>query_logs</code> table that directly feeds cost-tracking (7.4) and evaluation (8.5, 9.6) work.',
      'Standard relational fundamentals apply unchanged: primary/foreign keys, indexes on common lookup fields, transactions for multi-step writes that must succeed or fail together.',
      'Consider separating large trace/log payloads (Section 9.7) into their own table rather than mixing them into frequently-queried application tables, to avoid slowing down normal queries as that data grows.',
      'Design the <code>query_logs</code> table deliberately now — it\'s the direct data source for the Section 13.2 capstone\'s evaluation harness.',
    ],
    code: `-- Core schema for the Meridian Docs application

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_updated TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

-- Designed deliberately now, since Section 13.2's evaluation harness reads from this directly
CREATE TABLE query_logs (
    id SERIAL PRIMARY KEY,
    query_text TEXT NOT NULL,
    retrieved_chunk_ids TEXT[],
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_query_logs_created_at ON query_logs(created_at);
`,
    codeLabel: 'sql',
    note: {
      label: 'DECISION POINT',
      text: 'Design the query_logs table now, even before you have an evaluation harness that reads it — this is the same "instrument before you need it" principle from Section 9.7\'s tracing lesson, applied to your relational schema.',
      tone: 'green',
    },
    quiz: {
      question: 'Why does this lesson recommend designing the query_logs table (with token counts, latency, and retrieved chunk IDs) early, rather than adding it later once cost or evaluation problems actually appear?',
      options: [
        { label: 'PostgreSQL requires all tables to be defined before the application can run', correct: false },
        { label: 'Retrofitting this logging after a problem appears means historical data from before that point was never captured, the same "instrument before you need it" issue raised for tracing in Section 9.7', correct: true },
        { label: 'The query_logs table is required for pgvector to function', correct: false },
        { label: 'Foreign keys cannot be added to a table after it has been created', correct: false },
      ],
      explanation: 'If cost or evaluation problems only become visible after they\'ve been happening for a while, having query_logs in place from the start means that history is already captured and available to analyze — designing it after the fact means the exact period you\'d want to investigate has no data trail, which is the same principle Section 9.7 raised about instrumenting tracing before a confusing failure occurs, not after.',
    },
    crossRefs: ['9.7', '7.4', '8.5', '9.6'],
  },
  {
    id: '11.4',
    title: 'Authentication and Rate Limiting Basics',
    duration: '8 min',
    kind: 'concept',
    summary: [
      'An LLM-backed endpoint has a cost profile unlike most typical API endpoints — every request potentially costs real money (Section 7.4) and consumes a shared, sometimes rate-limited upstream resource (the LLM provider\'s API) — which makes authentication and rate limiting more directly tied to cost control here than for a typical CRUD API, where these concerns are usually framed purely in terms of security and fairness.',
      'Basic API authentication (an API key or a bearer token checked on each request, using FastAPI\'s dependency injection to enforce this consistently across protected routes) establishes who is making a request, which is a prerequisite for everything else in this lesson: rate limiting per user, the authorization-based retrieval filtering from Section 10.2, and the per-user cost attribution that Section 11.3\'s query_logs table enables.',
      '<em>Rate limiting</em> caps how many requests (or how many tokens, which maps more directly to actual cost) a given user or API key can consume in a given time window, protecting against both abuse (a malicious or buggy client hammering the endpoint) and accidental runaway cost (a client-side bug that retries in an infinite loop, which Section 7.3\'s bounded-retry discussion addressed from the calling side — rate limiting is the corresponding protection from the serving side).',
      'A common implementation pattern uses a fast, in-memory or Redis-backed counter per API key, incremented on each request and checked against a threshold before the request is allowed to proceed to the actual LLM call — checking and incrementing this counter should happen before the expensive LLM call, not after, since the entire point is avoiding the cost of a request that shouldn\'t be allowed to happen in the first place.',
      '<strong>Practical guidance:</strong> rate limit by tokens where possible, not just request count — a rate limit of "100 requests per minute" doesn\'t distinguish between 100 short classification requests and 100 requests each with a huge amount of context stuffed in, even though the latter costs dramatically more; a token-based limit maps much more directly to the actual cost being protected against.',
    ],
    keyPoints: [
      'Authentication (API key/bearer token) establishes who is making a request — a prerequisite for rate limiting, authorization-based retrieval filtering (10.2), and per-user cost attribution.',
      'Rate limiting protects against both abuse and accidental runaway cost (e.g. a client-side retry bug) — the serving-side counterpart to Section 7.3\'s bounded-retry protection on the calling side.',
      'Check and increment the rate-limit counter <strong>before</strong> the expensive LLM call, not after — the goal is avoiding the cost of a disallowed request entirely.',
      'Prefer token-based rate limits over pure request-count limits where possible — request count alone doesn\'t distinguish a cheap short request from an expensive context-heavy one.',
      'For an LLM-backed endpoint specifically, these controls tie directly to cost management (Section 7.4), not just security and fairness as in a typical API.',
    ],
    code: `from fastapi import FastAPI, Depends, HTTPException, Header
import time

app = FastAPI()

# --- Simple in-memory rate limiter (a real deployment would use Redis
# so limits are shared correctly across multiple server instances) ---
request_counts: dict[str, list[float]] = {}
RATE_LIMIT = 20          # requests
WINDOW_SECONDS = 60


def verify_api_key(x_api_key: str = Header(...)) -> str:
    user_id = look_up_user_by_api_key(x_api_key)  # implementation-specific
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return user_id


def check_rate_limit(user_id: str = Depends(verify_api_key)) -> str:
    now = time.time()
    recent_requests = [t for t in request_counts.get(user_id, []) if now - t < WINDOW_SECONDS]

    if len(recent_requests) >= RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={"error": "rate_limit_exceeded", "retry_after_seconds": WINDOW_SECONDS},
        )

    recent_requests.append(now)
    request_counts[user_id] = recent_requests
    return user_id


@app.post("/chat")
async def chat(request: ChatRequest, user_id: str = Depends(check_rate_limit)):
    # The rate limit check happens via the dependency BEFORE this handler's
    # body runs — a rejected request never reaches the LLM call at all.
    result = await call_llm_with_reliability(request.message)
    log_query(user_id=user_id, tokens_used=result.token_count)  # feeds Section 11.3's query_logs
    return {"answer": result.answer}
`,
    codeLabel: 'python',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Rate limiting is the serving-side mirror of Section 7.3\'s bounded-retry logic on the calling side — one prevents a client from accidentally hammering your service, the other prevents your service from accidentally hammering the LLM provider.',
      tone: 'green',
    },
    quiz: {
      question: 'A rate limiter checks and increments a user\'s request count AFTER the LLM call completes, rather than before. What problem does this ordering fail to prevent?',
      options: [
        { label: 'No problem — the ordering doesn\'t matter for rate limiting to work correctly', correct: false },
        { label: 'A user who has already exceeded their limit can still trigger additional costly LLM calls, since the check happens only after the (expensive) call has already been made', correct: true },
        { label: 'This ordering only affects authentication, not rate limiting', correct: false },
        { label: 'Checking after the call is actually the more efficient and recommended approach', correct: false },
      ],
      explanation: 'The entire purpose of rate limiting on an LLM-backed endpoint is to prevent the cost of a disallowed request from being incurred in the first place — checking the limit after the LLM call has already run means the expensive part of the request happens regardless of whether it should have been allowed, defeating the cost-protection goal of the rate limiter entirely.',
    },
    crossRefs: ['7.4', '10.2', '11.3', '7.3'],
  },
  {
    id: '11.5',
    title: 'Streaming Responses: Server-Sent Events for Chat UIs',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'A standard request/response call waits for the entire LLM generation to complete before returning anything to the client — for a long response, this can mean several seconds of a blank loading state before any text appears at all. <em>Streaming</em> instead sends each generated token (or small batch of tokens) to the client as soon as it\'s produced, letting a chat UI display text progressively, the way most production chat products behave.',
      '<em>Server-Sent Events (SSE)</em> is a standard, simple mechanism for this: an HTTP response that stays open and sends a sequence of small text-formatted events over time, rather than one complete response body all at once — most LLM provider SDKs support a streaming mode natively (the underlying API call returns an iterator of partial-response chunks instead of one complete response object), which maps naturally onto an SSE endpoint.',
      'Implementing this in FastAPI uses a <code>StreamingResponse</code> that wraps an async generator — the generator yields each chunk of the LLM\'s streamed output as it arrives from the provider, and FastAPI sends each one to the client as it\'s yielded, rather than buffering the entire response before sending anything.',
      'Streaming changes several things covered in earlier lessons of this section: error handling (11.2) becomes more complex, since a failure partway through a stream means the client has already received a partial response, not nothing — the stream needs a way to signal "this response was cut off due to an error," typically as a distinct final event, rather than relying on an HTTP status code that was already sent at the start of the response; timeouts (Section 7.3) need to account for the total stream duration rather than a single request/response round trip; and rate limiting (11.4) needs to account for tokens as they\'re generated, not just at the start of the request, if a stream can be cancelled mid-way by the client.',
      '<strong>Practical guidance:</strong> not every endpoint needs streaming — reserve it for user-facing chat-style interactions where perceived responsiveness matters; a backend-to-backend integration or a batch-processing job (Section 8.5\'s evaluation harness, for instance) has no benefit from streaming and is simpler to implement and debug as a standard request/response call.',
    ],
    keyPoints: [
      '<strong>Streaming</strong> sends generated tokens to the client progressively as they\'re produced, rather than waiting for the full response — reduces perceived latency for chat-style interactions.',
      '<strong>Server-Sent Events (SSE)</strong>: a standard mechanism for a long-lived HTTP response sending a sequence of events over time; most LLM provider SDKs natively support a streaming mode that maps onto this.',
      'FastAPI implements this with a <code>StreamingResponse</code> wrapping an async generator that yields each chunk as it arrives.',
      'Streaming complicates error handling (a failure mid-stream needs a distinct signal, since a status code was already sent), timeout accounting (total stream duration, not one round trip), and rate limiting (tokens generated even if a stream is cancelled early).',
      'Reserve streaming for user-facing chat interactions where perceived responsiveness matters — batch/backend-to-backend calls gain nothing from it and are simpler without it.',
    ],
    code: `from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from openai import OpenAI

app = FastAPI()
client = OpenAI()


async def stream_llm_response(prompt: str):
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        stream=True,   # the provider SDK's native streaming mode
    )

    try:
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                # Server-Sent Events format: "data: <payload>\\n\\n"
                yield f"data: {delta}\\n\\n"
    except Exception as e:
        # A failure mid-stream needs its own distinct signal — the HTTP
        # status code was already sent as 200 when streaming began.
        yield f"data: [ERROR: stream interrupted — {str(e)}]\\n\\n"
    finally:
        yield "data: [DONE]\\n\\n"   # explicit end-of-stream marker for the client


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    return StreamingResponse(
        stream_llm_response(request.message),
        media_type="text/event-stream",
    )

# Client-side (conceptual): an EventSource or fetch-based reader receives
# each "data: ..." event as it arrives and appends it to the visible chat
# message progressively, rather than waiting for one complete response.
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    R["Request received"] --> O["HTTP response opened (200)"]
    O --> T1["Token chunk 1 sent"]
    T1 --> T2["Token chunk 2 sent"]
    T2 --> T3["... more chunks ..."]
    T3 --> D["[DONE] marker sent, stream closed"]`,
    note: {
      label: 'COMMON PITFALL',
      text: 'A failure partway through a stream can\'t be signaled with a normal HTTP error status code, since 200 was already sent when streaming began — the stream needs its own explicit error event as part of its content.',
      tone: 'accent',
    },
    quiz: {
      question: 'An LLM call fails partway through a streaming response, after several chunks have already been sent to the client. Why can\'t this be signaled with a standard HTTP 500 error status code at that point?',
      options: [
        { label: 'HTTP 500 errors are never usable for LLM-backed endpoints', correct: false },
        { label: 'The HTTP status code (200) was already sent to the client at the start of the stream, before the failure occurred — the failure has to be communicated through the stream\'s content itself instead', correct: true },
        { label: 'FastAPI does not support returning error codes from any endpoint', correct: false },
        { label: 'This only applies to /search endpoints, not /chat', correct: false },
      ],
      explanation: 'In a standard (non-streaming) request/response call, the status code is sent along with the complete response, so an error can be signaled cleanly with e.g. a 500 status. In a stream, the status code is sent immediately when streaming begins — by the time a failure occurs partway through, that status code has already been committed as 200, so the only way to signal the failure is through the stream\'s own content, such as an explicit error event.',
    },
    crossRefs: ['8.5'],
  },
  {
    id: '11.6',
    title: 'Lab: Wiring a RAG Pipeline Behind a FastAPI Service',
    duration: '25 min',
    kind: 'assignment',
    summary: [
      'This lab combines every lesson in this section into one deployable service: the Section 8.6 citation-aware RAG system, exposed through a FastAPI application with request validation, PostgreSQL-backed conversation history, authentication, rate limiting, and a health check endpoint.',
      'Build the endpoint structure from 11.1 (<code>/chat</code>, <code>/upload</code>, <code>/search</code>, <code>/health</code>), with request/response validation per 11.2 and async handlers throughout. Wire in the PostgreSQL schema from 11.3: each chat request should look up (or create) a conversation, store both the user\'s message and the assistant\'s response in the <code>messages</code> table, and log the request\'s token counts and latency to <code>query_logs</code>.',
      'Add authentication and rate limiting per 11.4 — even a simple single-tier API key scheme is sufficient for this lab\'s purposes, but it should genuinely reject unauthorized or over-limit requests, not just log a warning. As an optional extension, add a <code>/chat/stream</code> endpoint per 11.5 alongside the standard <code>/chat</code> endpoint, and compare the perceived responsiveness of each in a simple test client.',
      'For the write-up: describe the full request lifecycle for a single <code>/chat</code> call, from the incoming HTTP request through authentication, rate-limit check, retrieval, generation, database writes, and response — this lifecycle description is exactly the kind of system explanation the Section 13.3 capstone defense will ask you to give at a larger scale, so treat this as practice for that requirement now.',
    ],
    keyPoints: [
      'Combines this section\'s lessons: FastAPI endpoint structure (11.1), request/response validation and async handlers (11.2), PostgreSQL persistence (11.3), authentication and rate limiting (11.4), and optionally streaming (11.5).',
      'Every chat request should persist to <code>conversations</code>/<code>messages</code> and log to <code>query_logs</code> — the data foundation for later evaluation work.',
      'Authentication and rate limiting must genuinely reject invalid/over-limit requests, not just log a warning.',
      'Write up the full request lifecycle explicitly — practice for the Section 13.3 capstone\'s system-defense requirement.',
      'This lab produces the deployable service that Section 12\'s containerization and CI/CD lessons build directly on top of.',
    ],
    code: `from fastapi import FastAPI, Depends
from pydantic import BaseModel
import time

app = FastAPI(title="Meridian Docs API")


class ChatRequest(BaseModel):
    message: str
    conversation_id: int | None = None


@app.post("/chat")
async def chat(request: ChatRequest, user_id: str = Depends(check_rate_limit)):  # 11.4
    start_time = time.time()

    # --- Conversation persistence (11.3) ---
    conversation_id = request.conversation_id or create_conversation(user_id, db)
    save_message(conversation_id, role="user", content=request.message, db=db)

    # --- Retrieval + generation (Section 8.6) ---
    result = answer_with_citations_hardened(request.message, vector_db, embed_model)  # Section 10.4

    save_message(conversation_id, role="assistant", content=result["answer"], db=db)

    # --- Query logging (11.3) — feeds evaluation (8.5, 9.6) and cost tracking (7.4) ---
    latency_ms = int((time.time() - start_time) * 1000)
    log_query(
        query_text=request.message,
        retrieved_chunk_ids=[s["source"] for s in result["sources"]],
        latency_ms=latency_ms,
        db=db,
    )

    return {
        "conversation_id": conversation_id,
        "answer": result["answer"],
        "sources": result["sources"],
    }


@app.get("/health")
async def health_check():
    db_ok = check_database_connection(db)
    vector_db_ok = check_vector_db_connection(vector_db)
    return {"status": "ok" if (db_ok and vector_db_ok) else "degraded",
            "database": db_ok, "vector_db": vector_db_ok}
`,
    codeLabel: 'python',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Writing out the full request lifecycle for /chat in your report is direct practice for the Section 13.3 capstone requirement to defend your system\'s design under questioning — start building that explanatory habit now, on a smaller system.',
      tone: 'green',
    },
    quiz: {
      question: 'The lab asks you to write out the complete request lifecycle for a single /chat call, from the incoming HTTP request through to the final response. What is the main purpose of this specific write-up requirement?',
      options: [
        { label: 'It is purely a formality with no bearing on later coursework', correct: false },
        { label: 'It builds the same system-explanation skill that the Section 13.3 capstone defense will require at a larger scale — practicing it now on a smaller, already-familiar system', correct: true },
        { label: 'FastAPI requires this documentation to generate its interactive API docs', correct: false },
        { label: 'It replaces the need for the query_logs table entirely', correct: false },
      ],
      explanation: 'Section 13.3 explicitly requires defending the capstone\'s full system design under questioning — being able to clearly narrate a request\'s full lifecycle (auth, rate limiting, retrieval, generation, persistence, response) is exactly that skill, and practicing it now on this smaller, simpler system builds the habit before it\'s needed on the much larger capstone system.',
    },
    crossRefs: ['8.6', '11.1', '11.2', '11.3', '11.4', '11.5', '10.4'],
  },
]
