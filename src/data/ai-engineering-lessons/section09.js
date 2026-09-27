export default [
  {
    id: '9.1',
    title: 'Tool Calling: How an LLM Decides to Act',
    duration: '12 min',
    kind: 'theory',
    summary: [
      'Everything covered through Section 8 has one shape: the LLM reads input (possibly including retrieved context) and generates text. <em>Tool calling</em> — sometimes called function calling — is the mechanism that lets an LLM do something beyond generating text: decide that, to answer a request, it needs to call an external function (a calculator, a database query, a web search, the RAG retriever from Section 8), receive that function\'s result, and continue reasoning with it.',
      'Mechanically, tool calling works by describing available tools to the model as part of the request — a name, a description of what the tool does, and a schema for its expected arguments (the same kind of schema used for structured outputs in Section 7.2). Given a user request, the model decides (based on the tool descriptions and the request) whether to respond directly or to output a structured "call this tool with these arguments" response instead of plain text.',
      'The application code, not the model itself, is responsible for actually executing the requested tool call — the model only decides <em>what</em> to call and <em>with what arguments</em>; your code runs the actual function, then sends the result back to the model as an additional piece of context, and the model continues, either producing a final answer or requesting another tool call. This loop (model decides → code executes → result returns → model continues) can repeat multiple times for a single user request.',
      'An <em>agent</em>, in the sense used throughout this section, is essentially this tool-calling loop wrapped with enough structure to handle multi-step tasks: the model can call several different tools across several iterations, using earlier results to inform later decisions, until it has enough information to produce a final answer — this is a direct generalization of the single-retrieval-step RAG pattern from Section 8 into a system that can decide, dynamically, what information it needs and how many times to go get more of it.',
      '<strong>Practical guidance:</strong> tool descriptions matter as much as prompt wording (Section 7.1) — a vaguely-described tool (unclear when to use it, ambiguous argument names) leads to a model calling it incorrectly or not calling it when it should; treat tool descriptions as prompts in their own right, worth iterating on with the same care.',
    ],
    keyPoints: [
      'Tool calling lets an LLM request that an external function be executed, rather than only generating text directly.',
      'The model decides <strong>what</strong> to call and <strong>with what arguments</strong>; your application code is responsible for actually <strong>executing</strong> the call and returning its result.',
      'The loop — model decides, code executes, result returns as context, model continues — can repeat multiple times for one request.',
      'An agent is this tool-calling loop generalized to multi-step tasks: deciding dynamically what information is needed and fetching it across several iterations.',
      'Tool descriptions function as prompts in their own right — a vague or ambiguous description leads directly to incorrect or missed tool calls.',
    ],
    code: `from openai import OpenAI
import json

client = OpenAI()

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_document_count",
            "description": "Returns how many documents are currently indexed for a given category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "The document category, e.g. 'billing' or 'legal'."}
                },
                "required": ["category"],
            },
        },
    }
]

def get_document_count(category: str) -> int:
    # In a real system this would query the actual document store.
    counts = {"billing": 142, "legal": 87}
    return counts.get(category, 0)


def run_agent_turn(user_message: str):
    messages = [{"role": "user", "content": user_message}]

    response = client.chat.completions.create(model="gpt-4o-mini", messages=messages, tools=tools)
    choice = response.choices[0]

    if choice.finish_reason == "tool_calls":
        tool_call = choice.message.tool_calls[0]
        args = json.loads(tool_call.function.arguments)

        # The APPLICATION, not the model, actually executes the function:
        result = get_document_count(**args)

        # Feed the result back so the model can continue reasoning with it
        messages.append(choice.message)
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": str(result),
        })
        final_response = client.chat.completions.create(model="gpt-4o-mini", messages=messages, tools=tools)
        return final_response.choices[0].message.content

    return choice.message.content


print(run_agent_turn("How many billing documents do we have indexed?"))
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    U["User request"] --> M["LLM: decide whether to answer directly or call a tool"]
    M -->|calls tool| E["Application executes the actual function"]
    E --> R["Result returned as context"]
    R --> M
    M -->|has enough info| F["Final answer"]`,
    note: {
      label: 'KEY INSIGHT',
      text: 'The model never executes anything itself — it only requests a tool call with arguments; your application code is the one actually running the function and is responsible for its safety and correctness.',
      tone: 'green',
    },
    quiz: {
      question: 'When an LLM "calls a tool" as part of an agent loop, who actually executes the underlying function?',
      options: [
        { label: 'The LLM itself executes the function internally', correct: false },
        { label: 'The application code — the model only decides what to call and with what arguments, then the application runs the actual function and returns the result', correct: true },
        { label: 'A separate specialized model is required to execute all tool calls', correct: false },
        { label: 'Tool execution happens automatically inside the vector database', correct: false },
      ],
      explanation: 'A tool call from the model is a structured request — a name and arguments — never actual code execution. The application receiving that request is responsible for running the real function safely and feeding the result back as context for the model to continue reasoning with. This separation is exactly what keeps tool execution auditable and controllable rather than opaque.',
    },
  },
  {
    id: '9.2',
    title: 'Agent Memory, State & Planning',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'A single tool-calling turn (9.1) is stateless in the sense that everything the model needs is in that one request\'s context. A multi-step agent handling a longer task needs to track more: what has already been tried, what results came back, and what the overall goal still requires — this is <em>agent state</em>.',
      'The simplest form of state is just the growing conversation history itself (as in 9.1\'s example, where each tool result gets appended to <code>messages</code>) — this works for short tasks but grows unboundedly and eventually exceeds the model\'s context window (Section 6.3) for longer-running agents. More structured state management tracks specific fields explicitly (e.g. "goal," "steps completed," "intermediate results," "remaining subtasks") rather than relying purely on raw conversation history, making it easier to reason about, log, and resume a long-running task.',
      '<em>Memory</em> distinguishes between what\'s needed for the current task (short-term, typically the conversation/state for this specific run) and what should persist across separate runs or sessions (long-term — e.g. "this user prefers responses in bullet points," recalled in a future, unrelated conversation). Long-term memory is usually implemented as its own small retrieval system, structurally similar to the RAG pattern from Section 8: relevant past facts are retrieved and injected into the current context, rather than the model somehow "remembering" across genuinely separate API calls, since an LLM API call has no memory of its own between requests.',
      '<em>Planning</em> refers to an agent explicitly reasoning about the sequence of steps needed before executing any of them, rather than deciding one tool call at a time reactively — e.g. an agent might first output "to answer this, I need to: 1) look up the current policy, 2) check the customer\'s account status, 3) combine both to determine eligibility" before making any tool calls at all. This can improve reliability on genuinely multi-step tasks by making the overall approach explicit and checkable (including by a human, per 9.4) before any action is taken, though it adds tokens and latency versus a purely reactive loop.',
      '<strong>Practical guidance:</strong> start with the simplest state representation (growing conversation history) and only move to explicit structured state or a separate memory system once a task genuinely requires tracking more than fits comfortably in a reasonable context window, or needs to persist across sessions — this mirrors the "start simple, add complexity when justified" pattern from Section 7.7\'s model-hosting guidance.',
    ],
    keyPoints: [
      '<strong>Agent state</strong> tracks what\'s been tried and learned so far during a multi-step task — the simplest form is just the growing conversation history.',
      'Structured state (explicit goal/steps/results fields) scales better than raw conversation history for longer-running tasks, and is easier to log and resume.',
      '<strong>Short-term memory</strong>: state for the current task/run. <strong>Long-term memory</strong>: facts that persist across separate sessions, typically implemented as its own small retrieval system similar to RAG.',
      '<strong>Planning</strong>: reasoning through the full sequence of steps before executing any, rather than deciding reactively one call at a time — improves reliability on complex tasks at the cost of extra tokens/latency.',
      'Start with the simplest state representation and add structure/persistence only once a specific task genuinely requires it.',
    ],
    code: `from dataclasses import dataclass, field

@dataclass
class AgentState:
    goal: str
    steps_completed: list[str] = field(default_factory=list)
    intermediate_results: dict = field(default_factory=dict)
    remaining_subtasks: list[str] = field(default_factory=list)

    def record_step(self, step_description: str, result):
        self.steps_completed.append(step_description)
        self.intermediate_results[step_description] = result
        if self.remaining_subtasks and self.remaining_subtasks[0] == step_description:
            self.remaining_subtasks.pop(0)

    def is_complete(self) -> bool:
        return len(self.remaining_subtasks) == 0


def plan_subtasks(goal: str, planning_llm) -> list[str]:
    """A planning step, run ONCE before any tool calls, rather than deciding
    reactively one step at a time."""
    plan_prompt = f"""Break this goal into a short, ordered list of concrete subtasks.
Goal: {goal}
Respond with a JSON list of subtask descriptions."""
    return planning_llm.generate_json(plan_prompt)


# --- Usage ---
state = AgentState(goal="Determine if this customer is eligible for a refund")
state.remaining_subtasks = plan_subtasks(state.goal, planning_llm=some_llm_client)
# e.g. ["Look up current refund policy", "Check customer's account status", "Compare against policy"]

while not state.is_complete():
    next_subtask = state.remaining_subtasks[0]
    result = execute_subtask(next_subtask)   # tool-calling loop from 9.1
    state.record_step(next_subtask, result)
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    G["Goal"] --> PL["Planning: break into ordered subtasks"]
    PL --> S1["Subtask 1"]
    S1 --> S2["Subtask 2"]
    S2 --> S3["Subtask 3"]
    S3 --> C["Combine results into final answer"]`,
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for explicit planning over purely reactive tool-calling when a task has several genuinely dependent steps (step 2 needs step 1\'s result) — for simple one- or two-tool tasks, reactive tool-calling alone is usually sufficient and avoids the extra planning overhead.',
      tone: 'green',
    },
    quiz: {
      question: 'An agent is handling a long-running task and its conversation history has grown to the point of nearly exceeding the model\'s context window. What is the most direct fix suggested by this lesson?',
      options: [
        { label: 'Switch to a completely different LLM provider', correct: false },
        { label: 'Move from tracking raw conversation history to explicit structured state (goal, completed steps, key intermediate results) instead of appending everything to an ever-growing message list', correct: true },
        { label: 'Disable tool calling entirely for this task', correct: false },
        { label: 'Increase the temperature parameter to compress the context', correct: false },
      ],
      explanation: 'Raw conversation history grows unboundedly with every tool call and result appended to it — structured state tracks only what actually matters (the goal, what\'s been done, key results) far more compactly, which is exactly the scaling problem this lesson identifies with the simplest state representation and the reason to move to something more structured once a task grows long enough.',
    },
  },
  {
    id: '9.3',
    title: 'Reflection, Self-Critique & Error Recovery',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'The tool-calling loop from 9.1 assumes every tool call succeeds and every result is useful — real systems need to handle the case where a tool fails, returns an unexpected or empty result, or where the agent\'s own reasoning turns out to be wrong partway through a task. This lesson covers patterns for an agent to notice and recover from these situations rather than plowing ahead with a broken plan.',
      '<em>Reflection</em> (or self-critique) has the model evaluate its own intermediate output before proceeding — e.g., after drafting an answer, prompting the model again with "review this answer for accuracy and completeness against the retrieved context; identify any issues" before finalizing it. This is a distinct, separate LLM call from the one that generated the original content, which matters because a model reviewing its own prior output with fresh, critical framing catches a meaningfully different set of errors than the same single generation pass would.',
      '<em>Error recovery</em> covers what happens when a tool call itself fails — a database query times out, an API returns an error, a search returns zero results. A well-designed agent treats a tool failure as information to reason about, not just an exception to propagate: feeding the error back to the model as context ("the document search returned zero results — try a broader search term") often lets the agent adjust its own approach, the same way a person would try a different search query after an unhelpful one, rather than the whole task failing outright.',
      'These two patterns compose into a broader reliability layer for agents, directly extending the reliability engineering ideas from Section 7.3 to the multi-step agent setting: bound the number of reflection/retry cycles (an agent stuck in an unproductive self-critique loop can burn tokens indefinitely without converging, mirroring the unbounded-retry pitfall from 7.3), and always have a defined fallback (return a partial result with an explicit note about what couldn\'t be completed, rather than either silently failing or looping forever).',
      '<strong>Common pitfall:</strong> assuming reflection makes an agent strictly more reliable with no downside. Reflection adds tokens, latency, and cost for every reflective pass, and an agent can occasionally "reflect" a correct answer into an incorrect one by over-correcting — the same failure mode Section 7.1 noted for unnecessary chain-of-thought on simple tasks. Reserve reflection for genuinely error-prone or high-stakes steps, not every step uniformly.',
    ],
    keyPoints: [
      '<strong>Reflection/self-critique</strong>: a separate LLM call reviews prior output before finalizing it — catches a different set of errors than the original generation pass alone.',
      '<strong>Error recovery</strong>: feed a tool failure back to the model as context to reason about, rather than only propagating an exception — this often lets the agent adjust its approach rather than failing the whole task.',
      'This extends Section 7.3\'s reliability engineering (bounded retries, explicit fallback) to the multi-step agent setting.',
      'Bound reflection/retry cycles explicitly — an unproductive self-critique loop can burn tokens indefinitely without converging.',
      'Reflection has real costs (tokens, latency, occasional over-correction of a correct answer) — reserve it for genuinely error-prone or high-stakes steps, not uniformly everywhere.',
    ],
    code: `def generate_with_reflection(question: str, context: str, llm, max_reflection_rounds: int = 2):
    draft_prompt = f"Answer using this context: {context}\\n\\nQuestion: {question}"
    answer = llm.generate(draft_prompt)

    for round_num in range(max_reflection_rounds):
        critique_prompt = f"""Review this answer for accuracy and completeness against the
provided context. If it is fully correct and complete, respond with exactly "OK".
Otherwise, list specific issues.

Context: {context}
Answer: {answer}"""
        critique = llm.generate(critique_prompt)

        if critique.strip() == "OK":
            break

        # Feed the critique back to produce a revised answer
        revision_prompt = f"""Revise this answer to address the following issues:
{critique}

Original context: {context}
Original answer: {answer}"""
        answer = llm.generate(revision_prompt)

    return answer


def call_tool_with_recovery(tool_fn, args: dict, agent_llm, max_attempts: int = 2):
    for attempt in range(max_attempts):
        try:
            result = tool_fn(**args)
            if not result:  # e.g. an empty search result — not an exception, but still a failure
                raise ValueError("Tool returned an empty result")
            return result
        except Exception as e:
            if attempt < max_attempts - 1:
                # Feed the failure back — let the AGENT reason about a different approach
                adjustment = agent_llm.generate(
                    f"The tool call with args {args} failed: {e}. "
                    f"Suggest adjusted arguments or a different approach."
                )
                args = parse_adjusted_args(adjustment)  # implementation-specific
            else:
                return {"error": str(e), "attempted_args": args}  # bounded fallback
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    D["Draft answer"] --> C["Critique pass (separate LLM call)"]
    C -->|issues found| REV["Revise answer"]
    REV --> C
    C -->|OK, or max rounds reached| FIN["Final answer"]`,
    note: {
      label: 'COMMON PITFALL',
      text: 'An unbounded reflection loop can burn tokens indefinitely without converging — always cap the number of reflection/revision rounds and fall back to the best available answer if the cap is reached.',
      tone: 'accent',
    },
    quiz: {
      question: 'An agent\'s tool call returns an empty search result rather than raising an exception. Why does this lesson treat this as a case worth explicit handling, distinct from a thrown error?',
      options: [
        { label: 'An empty result never actually indicates a problem and can be safely ignored', correct: false },
        { label: 'An empty result is a silent failure that won\'t be caught by exception handling alone — it needs its own explicit check, since the agent might otherwise proceed as if it had useful information', correct: true },
        { label: 'Empty results only occur with vector search, never with any other tool', correct: false },
        { label: 'This scenario cannot occur in a properly implemented agent', correct: false },
      ],
      explanation: 'A thrown exception is caught naturally by standard error handling, but a tool call that succeeds mechanically while returning nothing useful (an empty search result) won\'t trigger any exception at all — without an explicit check for this case, the agent could proceed as though it had found relevant information when it actually found nothing, producing a confidently wrong or unsupported downstream answer.',
    },
  },
  {
    id: '9.4',
    title: 'Multi-Agent Collaboration and Human-in-the-Loop Design',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'As a task grows more complex, a single agent juggling many different tools and responsibilities can become unwieldy — its instructions grow long, and it may confuse when to use one tool versus another. <em>Multi-agent</em> designs split responsibilities across several narrower agents, each with a focused role and a smaller set of tools, coordinated by either a fixed workflow or a "manager" agent that delegates subtasks to the appropriate specialist.',
      'A common pattern is a manager/worker split: a top-level agent receives the overall request, breaks it into subtasks (similar to the planning step in 9.2), and delegates each subtask to a specialized worker agent (e.g. a "research agent" that only searches and summarizes, a "database agent" that only queries structured data), then combines their results into a final response. This mirrors, at the agent level, the same separation-of-concerns principle that motivates breaking a large codebase into smaller, focused modules.',
      '<em>Human-in-the-loop (HITL)</em> design inserts an explicit approval step before a high-stakes or hard-to-reverse action — sending an email, executing a financial transaction, deleting data — rather than letting the agent act fully autonomously. This isn\'t a sign of an incomplete agent; it\'s a deliberate design choice reflecting that some actions warrant human judgment or accountability regardless of how reliable the agent generally is, similar to how many financial systems require human sign-off above a certain transaction size regardless of an automated system\'s general accuracy.',
      'Deciding where to place a HITL checkpoint is a risk-based judgment: the cost of a wrong autonomous action (financial loss, irreversible data change, reputational harm) should be weighed against the cost of the delay/friction a human-approval step introduces. A reasonable default is to require approval for any action that is irreversible or affects something outside the agent\'s own workspace (sending a message on someone\'s behalf, modifying a production system), and allow full autonomy for read-only or easily-reversible actions (searching, drafting a message for later review).',
      '<strong>Practical guidance:</strong> multi-agent design adds real coordination overhead (agents can disagree, or pass along an earlier agent\'s mistake without noticing) — reach for it once a single agent\'s scope has genuinely grown unwieldy, not as a default starting architecture; a single well-scoped agent handles most tasks in this course perfectly well, including the 9.8 lab.',
    ],
    keyPoints: [
      '<strong>Multi-agent design</strong>: splits responsibilities across narrower, focused agents (often a manager delegating to specialist workers) once a single agent\'s scope grows unwieldy.',
      'This mirrors the software-engineering principle of splitting a large codebase into smaller, focused modules — applied at the agent level.',
      '<strong>Human-in-the-loop</strong> inserts explicit approval before high-stakes or hard-to-reverse actions — a deliberate design choice, not a sign of an incomplete system.',
      'Placing a HITL checkpoint is a risk-based judgment: weigh the cost of a wrong autonomous action against the friction a human-approval step introduces.',
      'Default to requiring approval for irreversible or externally-visible actions; allow autonomy for read-only or easily-reversible ones.',
      'Multi-agent coordination has real overhead (an early agent\'s mistake can silently propagate) — reach for it once genuinely needed, not as a default starting point.',
    ],
    code: `from enum import Enum

class ActionRisk(Enum):
    LOW = "low"       # read-only or easily reversible — full autonomy
    HIGH = "high"      # irreversible or externally visible — requires approval

TOOL_RISK_LEVELS = {
    "search_documents": ActionRisk.LOW,
    "draft_email": ActionRisk.LOW,       # drafting is reversible; SENDING is not
    "send_email": ActionRisk.HIGH,
    "query_database": ActionRisk.LOW,
    "delete_record": ActionRisk.HIGH,
}

def execute_tool_call(tool_name: str, args: dict, request_human_approval_fn):
    risk = TOOL_RISK_LEVELS.get(tool_name, ActionRisk.HIGH)  # default to HIGH if unmapped

    if risk == ActionRisk.HIGH:
        approved = request_human_approval_fn(tool_name, args)
        if not approved:
            return {"status": "rejected_by_human", "tool": tool_name}

    return call_actual_tool(tool_name, args)  # implementation-specific


# --- A simple manager/worker multi-agent split ---
def manager_agent(user_request: str, worker_agents: dict, planning_llm):
    subtasks = plan_subtasks(user_request, planning_llm)  # from Lesson 9.2
    results = {}

    for subtask in subtasks:
        assigned_worker = route_to_worker(subtask, worker_agents)  # e.g. "research" vs "database"
        results[subtask] = assigned_worker.execute(subtask)

    return combine_results(results, user_request, planning_llm)
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    U["User request"] --> MA["Manager agent"]
    MA --> W1["Research worker"]
    MA --> W2["Database worker"]
    W1 --> RES["Combine results"]
    W2 --> RES
    RES --> HITL{"High-risk action?"}
    HITL -->|yes| H["Human approval"]
    HITL -->|no| A["Execute automatically"]
    H -->|approved| A`,
    note: {
      label: 'DECISION POINT',
      text: 'Default any tool not explicitly classified as low-risk to requiring human approval — an unclassified tool defaulting to autonomous execution is a much riskier failure mode than an unnecessary approval prompt.',
      tone: 'green',
    },
    quiz: {
      question: 'A new tool is added to an agent\'s toolkit but the team forgets to classify its risk level. Using the default-to-HIGH-risk pattern shown in this lesson, what happens?',
      options: [
        { label: 'The tool executes automatically without any approval, since it has no explicit classification', correct: false },
        { label: 'The tool requires human approval before executing, since unclassified tools default to the higher-risk, safer path rather than silently defaulting to full autonomy', correct: true },
        { label: 'The agent will refuse to load until the tool is manually classified', correct: false },
        { label: 'The tool is automatically assigned to a specialized worker agent', correct: false },
      ],
      explanation: 'Defaulting an unclassified tool to HIGH risk means the safer failure mode occurs when someone forgets to classify a new tool — an unnecessary approval prompt, rather than an unreviewed high-stakes action executing autonomously. This "default to the safer path when uncertain" pattern is a deliberate design choice for exactly this kind of oversight scenario.',
    },
  },
  {
    id: '9.5',
    title: 'Orchestration With LangGraph',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'The patterns covered so far in this section (tool-calling loops, state, reflection, multi-agent delegation) can all be hand-implemented with plain Python, as the code examples in 9.1–9.4 have done — but as an agent\'s logic grows more complex, with multiple conditional paths and loops, hand-rolled control flow becomes harder to reason about, test, and modify. <em>LangGraph</em> provides a structured way to define this control flow explicitly as a graph.',
      'A LangGraph graph is built from <em>nodes</em> (each a function representing one step — call an LLM, execute a tool, run a reflection check) and <em>edges</em> connecting them, including <em>conditional edges</em> that route to different next nodes based on the current state (e.g. "if the reflection check found issues, go back to the revision node; otherwise, proceed to the final-answer node"). This directly formalizes the reflection loop diagram from 9.3 and the tool-calling loop from 9.1 into an explicit, inspectable structure rather than an implicit sequence of if-statements buried in a function.',
      'State is passed between nodes as a single shared object (often a typed dictionary or dataclass, similar to the <code>AgentState</code> from 9.2), which each node can read from and update — this makes the flow of information through a multi-step agent explicit and traceable, since every node\'s input and output is the same well-defined state object rather than scattered variables.',
      'The graph structure also makes certain cross-cutting concerns easier to add uniformly: a human-in-the-loop checkpoint (9.4) can be inserted as a specific node type that pauses execution and waits for external approval before continuing along a given edge; observability (9.7) benefits directly from the graph\'s explicit structure, since each node execution is a natural unit to log and trace.',
      '<strong>Practical guidance:</strong> reach for a graph-based orchestration framework once an agent\'s control flow has more than a couple of conditional branches or loops — for the simple, single-loop tool-calling pattern from 9.1, plain Python is often clearer; LangGraph earns its complexity once you\'re combining multiple patterns from this section (planning, reflection, multi-agent delegation, HITL) into one coherent flow, which is exactly the shape the 9.8 lab asks you to build.',
    ],
    keyPoints: [
      'LangGraph formalizes an agent\'s control flow as an explicit graph of <strong>nodes</strong> (steps) and <strong>edges</strong> (transitions), including <strong>conditional edges</strong> that route based on current state.',
      'This directly formalizes patterns already covered informally: the reflection loop (9.3) and tool-calling loop (9.1) become explicit graph structures rather than implicit control flow.',
      'A shared, typed <strong>state object</strong> passes between nodes — similar in spirit to the <code>AgentState</code> from 9.2 — making the flow of information explicit and traceable.',
      'HITL checkpoints (9.4) and observability (9.7) both benefit from the graph\'s explicit node structure, since each node execution is a natural, well-defined unit to pause on or log.',
      'Reach for graph-based orchestration once control flow has multiple conditional branches or loops combining several patterns — plain Python remains clearer for simple, single-loop cases.',
    ],
    code: `from langgraph.graph import StateGraph, END
from typing import TypedDict

class AgentGraphState(TypedDict):
    question: str
    draft_answer: str
    critique: str
    final_answer: str
    revision_count: int


def draft_node(state: AgentGraphState) -> AgentGraphState:
    state["draft_answer"] = generate_draft(state["question"])  # Section 9.1-style tool loop
    return state

def critique_node(state: AgentGraphState) -> AgentGraphState:
    state["critique"] = run_critique(state["draft_answer"])    # Section 9.3's reflection pattern
    return state

def revise_node(state: AgentGraphState) -> AgentGraphState:
    state["draft_answer"] = revise_answer(state["draft_answer"], state["critique"])
    state["revision_count"] += 1
    return state

def finalize_node(state: AgentGraphState) -> AgentGraphState:
    state["final_answer"] = state["draft_answer"]
    return state


def should_revise(state: AgentGraphState) -> str:
    """Conditional edge: route based on current state, bounded to prevent
    an unbounded reflection loop (per Section 9.3's warning)."""
    if state["critique"] == "OK" or state["revision_count"] >= 2:
        return "finalize"
    return "revise"


graph = StateGraph(AgentGraphState)
graph.add_node("draft", draft_node)
graph.add_node("critique", critique_node)
graph.add_node("revise", revise_node)
graph.add_node("finalize", finalize_node)

graph.set_entry_point("draft")
graph.add_edge("draft", "critique")
graph.add_conditional_edges("critique", should_revise, {"revise": "revise", "finalize": "finalize"})
graph.add_edge("revise", "critique")   # loop back for another critique pass
graph.add_edge("finalize", END)

compiled_graph = graph.compile()
result = compiled_graph.invoke({"question": "...", "revision_count": 0})
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    ST["Start"] --> D["draft node"]
    D --> C["critique node"]
    C -->|needs revision, under limit| R["revise node"]
    R --> C
    C -->|OK or limit reached| F["finalize node"]
    F --> E["End"]`,
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The conditional edge should_revise makes the bounded-reflection-loop safeguard from Section 9.3 an explicit, visible part of the graph structure — rather than a check buried inside a plain Python while-loop, easy to overlook when the agent grows more complex.',
      tone: 'green',
    },
    quiz: {
      question: 'In the LangGraph example, why does should_revise check state["revision_count"] >= 2 in addition to checking whether the critique says "OK"?',
      options: [
        { label: 'It has no purpose and could be removed without changing behavior', correct: false },
        { label: 'It bounds the reflection loop from Section 9.3, preventing an unproductive revise-critique cycle from running indefinitely if the critique never returns "OK"', correct: true },
        { label: 'LangGraph requires every conditional edge to check a counter', correct: false },
        { label: 'It is only relevant when human-in-the-loop approval is also used', correct: false },
      ],
      explanation: 'Without a bound, a critique that never quite says "OK" (perhaps due to an overly strict or inconsistent critique prompt) could keep the revise→critique loop running forever, burning tokens without converging — this is exactly the unbounded-reflection-loop risk flagged in Section 9.3, and the revision_count check is what caps it, falling through to finalize regardless once the limit is reached.',
    },
  },
  {
    id: '9.6',
    title: 'Agent Evaluation: Task Success, Tool-Call Correctness & Regression Suites',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'Evaluating a RAG system (Section 8.5) is already more nuanced than evaluating a single LLM call — evaluating an agent is more nuanced still, because a multi-step agent can fail in more distinct ways: it can call the wrong tool, call the right tool with wrong arguments, call tools in an inefficient or looping order, or arrive at a correct final answer through an unreliable or accidental path that won\'t generalize to similar future requests.',
      '<em>Task success rate</em> is the most basic metric — across a set of representative test tasks, what fraction did the agent complete correctly? This alone hides important detail, similar to how accuracy alone hides detail in classification (Section 4.2): a 90% task success rate says nothing about whether the 10% of failures cluster around one specific tool or task type, which is exactly the information needed to actually fix the underlying problem.',
      '<em>Tool-call correctness</em> evaluates a finer-grained question: independent of whether the final answer was right, did the agent call the correct tool, with correct arguments, at each step? This is measurable by comparing the agent\'s actual tool-call sequence against an expected sequence for a given test task, and it catches a distinct failure mode from task success rate — an agent can occasionally reach a correct final answer despite an incorrect or inefficient tool-call path, which is a fragile success that a regression suite is specifically designed to catch before it compounds into a real failure on a slightly different input.',
      'A <em>regression suite</em> — a fixed, versioned set of test tasks run automatically whenever the agent\'s prompt, tools, or underlying model changes — is what catches a silent behavior change: a prompt tweak that improves one test case but quietly breaks three others is invisible without a suite to run consistently, exactly the way a code regression test suite catches an unintended side effect of a code change. This directly extends the "deterministic tests, evaluation datasets, regression tests" testing philosophy introduced generally in Section 12.2, applied specifically to agent behavior.',
      '<strong>Practical guidance:</strong> build the regression suite\'s test tasks from real failures you\'ve observed, not just hypothetical ones — every time an agent fails on an actual request during development or after deployment, add that exact request (or a close variant) to the suite, so the suite grows to reflect the agent\'s actual failure history rather than only your initial guesses about what might go wrong.',
    ],
    keyPoints: [
      'Agent evaluation is more nuanced than single-call LLM evaluation — failures can be in tool selection, tool arguments, tool-call ordering, or a fragile correct-answer-via-wrong-path.',
      '<strong>Task success rate</strong> is the most basic metric but hides which specific tasks/tools are failing, similar to accuracy hiding detail in classification.',
      '<strong>Tool-call correctness</strong> measures whether the correct tools were called with correct arguments, independent of whether the final answer happened to be right — catches fragile "right answer, wrong path" successes.',
      'A <strong>regression suite</strong> — a fixed, versioned test set run on every prompt/tool/model change — catches silent behavior changes the same way code regression tests catch unintended side effects.',
      'Build the regression suite from real observed failures over time, not just initial hypothetical test cases, so it reflects the agent\'s actual failure history.',
    ],
    code: `from dataclasses import dataclass

@dataclass
class AgentTestCase:
    task: str
    expected_tool_sequence: list[str]
    expected_answer_contains: str   # a substring/pattern check, not exact match


def evaluate_agent(test_cases: list[AgentTestCase], agent, log_full_trace=True) -> dict:
    results = {"task_success": 0, "tool_sequence_correct": 0, "failures": []}

    for case in test_cases:
        trace = agent.run_with_trace(case.task)  # returns tool calls made + final answer
        actual_tool_sequence = [call.tool_name for call in trace.tool_calls]

        tool_sequence_match = actual_tool_sequence == case.expected_tool_sequence
        answer_match = case.expected_answer_contains.lower() in trace.final_answer.lower()

        if tool_sequence_match:
            results["tool_sequence_correct"] += 1
        if answer_match:
            results["task_success"] += 1
        else:
            results["failures"].append({
                "task": case.task,
                "expected_tools": case.expected_tool_sequence,
                "actual_tools": actual_tool_sequence,
                "actual_answer": trace.final_answer,
            })

    n = len(test_cases)
    results["task_success_rate"] = results["task_success"] / n
    results["tool_correctness_rate"] = results["tool_sequence_correct"] / n
    return results


# --- A regression suite grown from real observed failures ---
regression_suite = [
    AgentTestCase(
        task="How many billing documents were added last month?",
        expected_tool_sequence=["search_documents", "get_document_count"],
        expected_answer_contains="billing",
    ),
    # Added after a real production failure where the agent skipped the search step:
    AgentTestCase(
        task="What's the refund policy for enterprise customers specifically?",
        expected_tool_sequence=["search_documents"],
        expected_answer_contains="enterprise",
    ),
]

report = evaluate_agent(regression_suite, my_agent)
print(f"task success: {report['task_success_rate']:.0%}, "
      f"tool correctness: {report['tool_correctness_rate']:.0%}")
if report["failures"]:
    print("Failing cases:", report["failures"])
`,
    codeLabel: 'python',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'An agent that reaches the right answer via an incorrect or inefficient tool-call path is a fragile success — the regression suite\'s tool-call correctness check is what surfaces this before it fails outright on a slightly different, similar request.',
      tone: 'green',
    },
    quiz: {
      question: 'An agent achieves 100% task success rate on a regression suite, but tool-call correctness is only 70% — some tasks succeed via an unexpected tool-call sequence. What does this combination suggest?',
      options: [
        { label: 'The regression suite must be misconfigured, since 100% task success should imply 100% tool correctness', correct: false },
        { label: 'Some tasks are reaching correct answers through fragile, possibly accidental tool-call paths that may not generalize reliably to similar future requests', correct: true },
        { label: 'The agent is definitely production-ready and needs no further changes', correct: false },
        { label: 'Tool-call correctness is not a meaningful metric once task success is measured', correct: false },
      ],
      explanation: 'These two metrics measure genuinely different things: task success only checks the final answer, while tool-call correctness checks the actual path taken to get there. A gap between them — perfect answers via imperfect paths — is exactly the "right answer, wrong path" fragile-success pattern this lesson describes, and it\'s a signal worth investigating before it fails on a similar but not identical future request where the same shortcut doesn\'t happen to work.',
    },
  },
  {
    id: '9.7',
    title: 'Observability & Tracing for Agent Runs',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'When an agent produces a wrong or unexpected result in production, the evaluation techniques from 9.6 tell you <em>that</em> a failure occurred, but debugging <em>why</em> a specific run went wrong requires visibility into exactly what happened during that run — which tool was called, with what arguments, what each tool returned, and what the LLM saw at each step of its reasoning. This is <em>observability</em>, and the mechanism for capturing it is called <em>tracing</em>.',
      'A <em>trace</em> records the full sequence of events in one agent run as a structured, timestamped log: each LLM call (with its exact input and output), each tool call (with its arguments and result), and the state at each transition (per the LangGraph state object from 9.5, if used). Purpose-built tracing tools for LLM applications (e.g. LangSmith, Langfuse) capture this automatically when integrated with a framework like LangGraph, and present it as a navigable timeline — letting you inspect, for a specific failed run, exactly which step diverged from the expected behavior.',
      'This differs meaningfully from traditional application logging: a normal backend log typically records discrete events (a request came in, a query ran, a response was sent), while an agent trace needs to capture a branching, sometimes-looping sequence of LLM reasoning steps interleaved with tool calls — closer to a debugger\'s step-through view of a program\'s execution than a flat log file, which is why dedicated LLM-tracing tools exist rather than agents relying purely on generic application logging.',
      'Tracing earns its value specifically when something goes wrong in a way the regression suite (9.6) didn\'t anticipate: a real user\'s phrasing triggers a tool-call sequence no test case covered, and the trace lets you see exactly where the agent\'s reasoning diverged from what you\'d expect — informing both an immediate fix and a new regression-suite test case (9.6) added from that real failure, closing the loop between production observability and the evaluation suite.',
      '<strong>Practical guidance:</strong> instrument tracing before you need it, not after a confusing production failure — retrofitting tracing after the fact means the specific failed run that prompted the investigation was never captured in the first place, leaving you debugging from memory or incomplete logs rather than an actual recorded trace.',
    ],
    keyPoints: [
      'Evaluation (9.6) reveals <strong>that</strong> a failure occurred; a <strong>trace</strong> reveals <strong>why</strong> a specific run failed, by recording the exact sequence of LLM calls, tool calls, and state transitions.',
      'A trace captures a branching, sometimes-looping reasoning sequence — closer to a debugger\'s step-through view than a flat application log.',
      'Purpose-built LLM-tracing tools (e.g. LangSmith, Langfuse) integrate with frameworks like LangGraph to capture this automatically as a navigable timeline.',
      'A confusing production failure, once traced, should feed directly back into the regression suite (9.6) as a new test case — closing the loop between observability and evaluation.',
      'Instrument tracing before it\'s needed — retrofitting it after a confusing failure means that specific failure was never actually captured.',
    ],
    code: `from langsmith import traceable

@traceable(name="search_documents_tool")
def search_documents(query: str) -> list[str]:
    # The @traceable decorator automatically logs this call's arguments,
    # return value, and timing into the trace for this agent run.
    return vector_db.similarity_search(query)


@traceable(name="agent_run")
def run_agent(user_request: str):
    plan = plan_subtasks(user_request, planning_llm=llm)   # also traced, if decorated
    results = []
    for subtask in plan:
        result = search_documents(subtask)   # nested call — appears as a child span in the trace
        results.append(result)
    return combine_results(results, user_request, llm)


# When run_agent("...") executes, the tracing tool records a navigable
# timeline like:
#
#   agent_run
#   ├── plan_subtasks        (1.2s, input: "...", output: [...])
#   ├── search_documents      (0.4s, input: "subtask 1", output: [...])
#   ├── search_documents      (0.3s, input: "subtask 2", output: [])  <-- empty! worth investigating
#   └── combine_results       (0.9s, input: [...], output: "final answer")
#
# The empty result on the second search_documents call is now directly
# visible and timestamped, rather than something you'd have to infer
# after the fact from an ambiguous final answer.
`,
    codeLabel: 'python',
    mermaid: `flowchart TB
    R["Agent run"] --> P["plan_subtasks (traced)"]
    P --> S1["search_documents: subtask 1 (traced)"]
    P --> S2["search_documents: subtask 2 (traced) — empty result"]
    S1 --> C["combine_results (traced)"]
    S2 --> C
    C --> O["Final answer"]`,
    note: {
      label: 'WHY THIS MATTERS',
      text: 'A confusing production failure that gets properly traced should become a new regression-suite test case (9.6) — this is what turns a one-off debugging session into a permanent improvement to the evaluation suite.',
      tone: 'green',
    },
    quiz: {
      question: 'A user reports that an agent gave a confusing, seemingly unrelated answer to their question, but the regression suite shows no failures. What is the most useful next step?',
      options: [
        { label: 'Assume the regression suite is comprehensive and the user\'s report can be dismissed', correct: false },
        { label: 'Examine the trace for that specific run to see exactly which tool calls and reasoning steps occurred, since the regression suite by definition only covers previously-known failure patterns', correct: true },
        { label: 'Immediately retrain the underlying LLM', correct: false },
        { label: 'Increase the agent\'s temperature setting to make future answers more consistent', correct: false },
      ],
      explanation: 'A regression suite only catches failures matching its existing test cases — a genuinely new failure pattern from a real user\'s specific phrasing won\'t be caught by it, which is exactly why observability/tracing exists as a complementary tool: examining the actual recorded trace of that specific run reveals where the agent\'s reasoning diverged, which then informs both a fix and a new regression-suite case built from this real failure.',
    },
  },
  {
    id: '9.8',
    title: 'Lab: Building a Multi-Tool Research Agent',
    duration: '30 min',
    kind: 'assignment',
    summary: [
      'This lab is the fourth of this course\'s five flagship portfolio projects: a research agent that can choose between multiple tools — web search, a calculator, and the RAG retriever built in Section 8.6 — to answer a research question and produce a final report, combining most of this section\'s patterns into one working system.',
      'Build the tool set first: wrap web search, a simple calculator, and the Section 8 RAG retriever as tool-calling functions (9.1), each with a clear, specific description. Add explicit state tracking (9.2) so the agent can accumulate findings across multiple tool calls rather than losing earlier results. Use LangGraph (9.5) to structure the control flow explicitly, since this agent genuinely combines multiple conditional paths — deciding which tool to use next, whether enough information has been gathered, and when to produce the final report.',
      'Add at least one reliability pattern from 9.3: either a reflection pass on the draft report before finalizing, or explicit error recovery for a tool call that returns an empty or failed result (e.g. a web search with no results, prompting the agent to try a reformulated query rather than giving up). Classify each tool\'s risk level per 9.4\'s pattern — for this lab, all three tools (search, calculator, retrieval) are read-only and should reasonably be classified as low-risk, requiring no human approval, which is itself worth stating explicitly in your write-up as a deliberate risk assessment rather than an oversight.',
      'Build a small regression suite (9.6) of at least 8 test tasks with expected tool sequences and expected answer content, and instrument tracing (9.7) so a failing test case in the suite can be debugged by examining its actual trace rather than only its pass/fail result. Report task success rate and tool-call correctness rate in your write-up, and include at least one example of a traced run where the agent\'s behavior diverged from expectations, plus what you changed as a result.',
    ],
    keyPoints: [
      'Combines this section\'s patterns: tool calling (9.1), state (9.2), reflection/error recovery (9.3), risk classification (9.4), LangGraph orchestration (9.5), evaluation (9.6), and tracing (9.7).',
      'Tools: web search, calculator, and the Section 8.6 RAG retriever — each wrapped with a clear, specific tool description.',
      'All three tools are read-only/low-risk for this lab — explicitly stating this risk assessment in the write-up matters, not just implementing the HITL mechanism.',
      'Build and report against a regression suite (task success rate, tool-call correctness rate), with at least one traced failure example and the fix that resulted from it.',
      'This is portfolio project #4 of this course\'s five flagship projects.',
    ],
    code: `from langgraph.graph import StateGraph, END
from typing import TypedDict
from langsmith import traceable

class ResearchAgentState(TypedDict):
    question: str
    findings: list[str]
    remaining_subtasks: list[str]
    draft_report: str
    final_report: str

@traceable(name="search_web_tool")
def search_web(query: str) -> str:
    return web_search_api.search(query)   # implementation-specific

@traceable(name="calculate_tool")
def calculate(expression: str) -> float:
    return safe_eval(expression)           # NEVER use raw eval() on untrusted input

@traceable(name="rag_retrieve_tool")
def rag_retrieve(query: str) -> str:
    return answer_with_citations(query, vector_db, embed_model)["answer"]  # from Section 8.6

TOOLS = {"search_web": search_web, "calculate": calculate, "rag_retrieve": rag_retrieve}
# All three tools are READ-ONLY — no HITL approval required, per this lab's explicit
# risk classification (Section 9.4): none of them modify state outside the agent's own workspace.

@traceable(name="research_step")
def research_step(state: ResearchAgentState) -> ResearchAgentState:
    if not state["remaining_subtasks"]:
        return state
    subtask = state["remaining_subtasks"][0]
    tool_name, args = decide_tool(subtask, TOOLS.keys())  # LLM decides, per 9.1

    result = TOOLS[tool_name](**args) or None
    if result is None:
        # Error recovery, per 9.3: reformulate rather than giving up
        reformulated = reformulate_query(subtask)
        result = TOOLS[tool_name](**{**args, "query": reformulated})

    state["findings"].append(result)
    state["remaining_subtasks"].pop(0)
    return state

def is_research_complete(state: ResearchAgentState) -> str:
    return "compile_report" if not state["remaining_subtasks"] else "research_step"

def compile_report(state: ResearchAgentState) -> ResearchAgentState:
    state["draft_report"] = synthesize_findings(state["findings"], state["question"])
    state["final_report"] = reflect_and_revise(state["draft_report"])  # 9.3's reflection pattern
    return state

graph = StateGraph(ResearchAgentState)
graph.add_node("research_step", research_step)
graph.add_node("compile_report", compile_report)
graph.set_entry_point("research_step")
graph.add_conditional_edges("research_step", is_research_complete,
                             {"research_step": "research_step", "compile_report": "compile_report"})
graph.add_edge("compile_report", END)
research_agent = graph.compile()
`,
    codeLabel: 'python',
    note: {
      label: 'DECISION POINT',
      text: 'Stating explicitly in your write-up that all three tools were classified low-risk (and why) demonstrates the same deliberate risk-assessment habit that a genuinely high-stakes agent would need — even when, for this lab, the actual answer is "no approval gate needed."',
      tone: 'green',
    },
    quiz: {
      question: 'The research agent lab uses only read-only tools (search, calculator, RAG retrieval). According to Section 9.4\'s risk-classification pattern, what HITL configuration is appropriate?',
      options: [
        { label: 'Every tool call still requires human approval regardless of risk level', correct: false },
        { label: 'No approval gate is needed for any of these tools, since all three are read-only and don\'t modify anything outside the agent\'s own workspace — but this should be an explicit, stated assessment, not an unexamined default', correct: true },
        { label: 'HITL design is irrelevant to agents that only use read-only tools', correct: false },
        { label: 'Only the calculator tool needs approval, since it involves numerical computation', correct: false },
      ],
      explanation: 'Per Section 9.4\'s risk-based approach, read-only, easily-reversible actions reasonably warrant full autonomy — but the lab specifically asks for this to be a stated, deliberate assessment in the write-up, since the value of the risk-classification habit is in consistently making this judgment explicit, not in memorizing that "read-only tools never need approval" as a rule to apply unreflectively.',
    },
  },
]
