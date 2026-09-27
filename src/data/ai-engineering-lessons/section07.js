export default [
  {
    id: '7.1',
    title: 'Prompt Engineering Patterns: Zero-Shot, Few-Shot & Chain-of-Thought',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'This section shifts from how an LLM works internally (Section 6) to how to use one effectively as a product-building tool — the highest-leverage skill in AI engineering, per the framing in Lesson 1.1. Prompting is the primary interface for shaping the probability distribution an LLM samples from (recall 6.5) toward the output you actually want.',
      '<em>Zero-shot prompting</em> asks the model to perform a task with only an instruction, no examples — this works well when the task is common and the instruction is unambiguous ("summarize this in one sentence"). <em>Few-shot prompting</em> includes a small number of example input/output pairs directly in the prompt before the actual request, which helps substantially when the desired output format, tone, or edge-case handling is specific and hard to describe in words alone — the model infers the pattern from the examples rather than from an abstract description of it.',
      '<em>Chain-of-thought prompting</em> asks the model to reason step by step before giving a final answer (e.g. "think through this step by step, then give your final answer"), which measurably improves performance on tasks requiring multi-step reasoning or arithmetic — because the model\'s own intermediate reasoning tokens become part of the context it conditions on for the final answer, effectively giving it more "working space" than jumping straight to a conclusion.',
      'These patterns compose: a few-shot prompt can also request chain-of-thought reasoning in each example, showing the model both the desired reasoning style and the desired final-answer format simultaneously. The right choice depends on the task: reach for zero-shot first (it\'s cheapest, in both tokens and effort), add few-shot examples when output format or style needs to be more specific than words alone can pin down, and add chain-of-thought when the task genuinely requires multi-step reasoning rather than direct pattern recall.',
      '<strong>Common pitfall:</strong> adding chain-of-thought to simple tasks that don\'t need it — this increases token cost (Section 7.4) and latency for no accuracy benefit, and can occasionally cause a model to second-guess a correct instinctive answer into an incorrect "reasoned" one.',
    ],
    keyPoints: [
      '<strong>Zero-shot</strong>: instruction only, no examples — cheapest, works for common/unambiguous tasks.',
      '<strong>Few-shot</strong>: a handful of example input/output pairs in the prompt — best when format/style/edge cases are hard to describe in words alone.',
      '<strong>Chain-of-thought</strong>: ask the model to reason step by step before answering — improves multi-step reasoning tasks by giving the model more "working space" in its own context.',
      'These patterns compose — a few-shot prompt\'s examples can themselves demonstrate chain-of-thought reasoning.',
      'Reach for the cheapest pattern that solves the task; unnecessary chain-of-thought adds cost and latency without benefit on simple tasks.',
    ],
    code: `# Zero-shot
zero_shot_prompt = """Classify the sentiment of this review as positive, negative, or neutral.

Review: "The battery life is disappointing but the camera is excellent."
Sentiment:"""

# Few-shot — examples pin down a specific, non-obvious output format
few_shot_prompt = """Extract the product name and issue from each support ticket.

Ticket: "My UltraWatch 5 screen keeps flickering."
Output: {"product": "UltraWatch 5", "issue": "screen flickering"}

Ticket: "The SoundPod earbuds won't pair with my phone."
Output: {"product": "SoundPod", "issue": "pairing failure"}

Ticket: "My laptop fan is extremely loud under light load."
Output:"""

# Chain-of-thought — for a task that genuinely needs multi-step reasoning
cot_prompt = """A store had 84 items. They sold 60% of them on Monday, then
restocked 15 items. How many items are in the store now?

Think through this step by step, then give your final answer as a single number."""
`,
    codeLabel: 'python',
    note: {
      label: 'WHEN TO USE',
      text: 'Start with zero-shot for any new task — only add few-shot examples or chain-of-thought reasoning once you\'ve observed a specific failure mode that they would address.',
      tone: 'green',
    },
    quiz: {
      question: 'A prompt asks an LLM to classify short product reviews as positive or negative — a simple, common task. Adding chain-of-thought reasoning ("think step by step") to this prompt is likely to:',
      options: [
        { label: 'Significantly improve accuracy on this task', correct: false },
        { label: 'Add token cost and latency with little to no accuracy benefit, since the task doesn\'t require multi-step reasoning', correct: true },
        { label: 'Be strictly required for any classification task', correct: false },
        { label: 'Have no effect on cost or latency at all', correct: false },
      ],
      explanation: 'Chain-of-thought reasoning helps most on tasks requiring genuine multi-step reasoning — a direct sentiment classification is typically a single-step pattern-recognition task the model can already do well zero-shot. Adding unnecessary reasoning tokens increases cost and latency without a corresponding accuracy gain, and is a common over-engineering pitfall in prompt design.',
    },
    crossRefs: ['1.1', '6.5'],
  },
  {
    id: '7.2',
    title: 'Structured Outputs and Schema-Constrained Generation',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'Most AI-engineered products need an LLM\'s output to be machine-readable — feeding into a database, another API call, or a UI component — not just prose. Since an LLM fundamentally generates text token by token (Section 6.5), getting reliable structured (typically JSON) output requires deliberate technique, not just asking nicely.',
      'The most basic approach is prompting for JSON directly, with an explicit schema description and an example in the prompt (combining the few-shot pattern from 7.1). This works reasonably often but is not guaranteed — the model can still produce invalid JSON (a missing bracket, wrong field name, extra prose before the JSON starts), especially on longer or more complex schemas.',
      'A more reliable approach uses provider-side structured output features (e.g. an API\'s <code>response_format</code> with a JSON schema, or function/tool-calling schemas that constrain the exact fields the model can return) — these constrain the generation itself at the token level in many implementations, rather than relying purely on the model choosing to comply with an instruction. Where available, prefer this over prompt-only JSON requests.',
      'Regardless of which generation approach is used, always validate the output against a schema after receiving it — a library like Pydantic can parse and validate structured output in one step, raising a clear error on any field that\'s missing, wrong-typed, or fails a constraint, rather than letting malformed data propagate silently into the rest of the application.',
      '<strong>Common pitfall:</strong> assuming a "guaranteed JSON" API feature means the JSON is guaranteed to be <em>semantically correct</em> — the model can still return syntactically valid JSON with a hallucinated or wrong value in a field (e.g. a plausible-looking but incorrect extracted phone number). Schema validation catches structural problems; it does not catch content problems, which is what Section 7.3\'s output validation and Section 8.5\'s evaluation work address separately.',
    ],
    keyPoints: [
      'LLMs generate text token by token — structured (JSON) output requires deliberate technique, not just a polite request.',
      'Prompt-only JSON requests work often but aren\'t guaranteed — prefer provider-side structured output / schema-constrained generation features where available.',
      'Always validate output against a schema (e.g. with Pydantic) after generation, regardless of which generation technique produced it.',
      'Schema validation catches structural problems (wrong type, missing field) — it does <strong>not</strong> catch semantically wrong but well-formed content, like a hallucinated value in a correctly-typed field.',
      'Treat "guaranteed valid JSON" and "guaranteed correct content" as two separate claims — a feature guaranteeing the first says nothing about the second.',
    ],
    code: `from pydantic import BaseModel, ValidationError
from openai import OpenAI

client = OpenAI()

class ExtractedIssue(BaseModel):
    product: str
    issue: str
    urgency: str  # "low", "medium", "high"


def extract_issue(ticket_text: str) -> ExtractedIssue:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Extract structured data from support tickets."},
            {"role": "user", "content": ticket_text},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "extracted_issue",
                "schema": ExtractedIssue.model_json_schema(),
            },
        },
    )
    raw_json = response.choices[0].message.content

    # Structural validation — catches malformed/mistyped output, NOT wrong content
    try:
        return ExtractedIssue.model_validate_json(raw_json)
    except ValidationError as e:
        raise ValueError(f"Model returned schema-invalid output: {e}")


result = extract_issue("My UltraWatch 5 screen keeps flickering and it's urgent!")
print(result)
`,
    codeLabel: 'python',
    note: {
      label: 'WARNING',
      text: 'Schema validation only confirms the JSON is well-formed and correctly typed — it cannot confirm the extracted values are factually correct. A field can pass validation while still containing a confidently wrong value.',
      tone: 'accent',
    },
    quiz: {
      question: 'An LLM returns syntactically valid JSON matching the expected schema exactly, but one field contains a phone number that is subtly wrong (a hallucinated digit). Would standard schema validation (e.g. Pydantic) catch this?',
      options: [
        { label: 'Yes — schema validation checks both structure and factual correctness', correct: false },
        { label: 'No — schema validation only confirms the JSON is well-formed and correctly typed; it cannot verify the content is factually accurate', correct: true },
        { label: 'Only if the phone number field is marked as "required" in the schema', correct: false },
        { label: 'Only if response_format is set to json_schema rather than a plain prompt', correct: false },
      ],
      explanation: 'Schema validation checks structure — the right fields exist, with the right types, satisfying any format constraints — but has no way to know that "555-0142" should have actually been "555-0143". Catching semantically wrong-but-well-formed content requires a different mechanism (fact-checking against a source, or evaluation against a known-correct answer), not schema validation.',
    },
    crossRefs: ['6.5', '7.1'],
  },
  {
    id: '7.3',
    title: 'Reliability Engineering for LLM Calls: Retries, Timeouts & Validation',
    duration: '12 min',
    kind: 'concept',
    summary: [
      'Every LLM call is a network call to an external, occasionally unreliable service — the same reliability discipline that applies to any external API call (Section 1.3) applies here, plus a few AI-specific failure modes that a typical REST API integration doesn\'t need to worry about.',
      'Standard reliability patterns apply directly: set an explicit <em>timeout</em> (an LLM call that hangs indefinitely blocks whatever is waiting on it — usually a user-facing request); <em>retry</em> transient failures (rate limits, momentary server errors) with exponential backoff, but distinguish these from failures that retrying won\'t fix (a malformed request, an invalid API key); consider a <em>fallback</em> — a smaller/faster/different model, or a cached previous response — for when the primary model is unavailable or too slow.',
      'AI-specific failure modes layer on top: a response that\'s syntactically fine but fails schema validation (7.2) needs its own retry path — often by re-prompting with the validation error included, asking the model to correct its own output; a response that\'s valid but empty or refuses the request needs to be detected and handled distinctly from an outright API error; and a response that exceeds an expected length or takes unusually long can signal the model going into an unproductive repetitive loop, worth cutting off rather than waiting out.',
      'Because retrying an LLM call costs real money (Section 7.4) and adds latency, retry logic should be bounded (a small maximum retry count) and observable (log every retry with its cause) — an unbounded retry loop against a genuinely broken input can quietly run up a large bill trying to fix something no retry will fix.',
      '<strong>Practical guidance:</strong> layer these checks as a pipeline — input validation, before the call; the call itself, with timeout and retry; output validation, after the call, with a bounded re-prompt-and-retry path for validation failures specifically; and a final fallback path if all retries are exhausted. This is the exact structure the 7.5 lab builds.',
    ],
    keyPoints: [
      'LLM calls need the same reliability discipline as any external API call: explicit timeouts, bounded retries with backoff, and a fallback path.',
      'Distinguish retryable failures (rate limits, transient errors) from non-retryable ones (bad request, invalid key) — retrying the latter wastes time and money without ever succeeding.',
      'AI-specific failure modes: schema-invalid output (retry with the validation error fed back to the model), empty/refused responses, and runaway-length responses.',
      'Bound and log every retry — an unbounded retry loop against a genuinely broken input can silently run up significant cost.',
      'Structure as a pipeline: input validation → call (timeout + retry) → output validation (bounded re-prompt on failure) → fallback if exhausted.',
    ],
    code: `import time
from openai import OpenAI, RateLimitError, APITimeoutError
from pydantic import ValidationError

client = OpenAI(timeout=10.0)  # explicit timeout — never let a call hang indefinitely

MAX_RETRIES = 3

def call_with_reliability(prompt: str, schema_model) -> object:
    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
            )
            raw_output = response.choices[0].message.content

            # AI-specific validation step, separate from the network call itself
            try:
                return schema_model.model_validate_json(raw_output)
            except ValidationError as ve:
                # Retry with the validation error fed back — often self-corrects
                prompt = f"{prompt}\\n\\nYour previous output was invalid: {ve}\\nPlease correct it."
                last_error = ve
                continue

        except (RateLimitError, APITimeoutError) as e:
            # RETRYABLE: transient — back off and try again
            last_error = e
            time.sleep(2 ** attempt)
            continue

        except Exception as e:
            # NON-RETRYABLE: fail fast, don't waste further attempts
            raise RuntimeError(f"Non-retryable LLM call failure: {e}") from e

    raise RuntimeError(f"Exhausted {MAX_RETRIES} retries. Last error: {last_error}")
`,
    codeLabel: 'python',
    mermaid: `flowchart LR
    I["Input validation"] --> C["LLM call (timeout + backoff retry)"]
    C --> V["Output schema validation"]
    V -->|invalid| RP["Re-prompt with validation error"]
    RP --> C
    V -->|valid| R["Return result"]
    C -->|retries exhausted| FB["Fallback response"]`,
    note: {
      label: 'COMMON PITFALL',
      text: 'Retrying a non-retryable failure (like an invalid API key or a malformed request) burns through the retry budget and adds latency without any chance of success — always distinguish retryable from non-retryable errors explicitly.',
      tone: 'accent',
    },
    quiz: {
      question: 'An LLM call fails with an authentication error (invalid API key). What is the correct handling?',
      options: [
        { label: 'Retry with exponential backoff, same as a rate-limit error', correct: false },
        { label: 'Fail immediately without retrying — this error will not resolve itself no matter how many times the call is retried', correct: true },
        { label: 'Switch to a fallback model and retry indefinitely', correct: false },
        { label: 'Increase the timeout duration and retry once', correct: false },
      ],
      explanation: 'An authentication error is not a transient condition — retrying it will fail identically every time and only wastes time while providing no chance of success. Retrying should be reserved for genuinely transient failures (rate limits, momentary server errors); non-retryable failures should fail fast so the underlying problem (e.g. a bad credential) gets fixed instead of masked by pointless retries.',
    },
    crossRefs: ['1.3'],
  },
  {
    id: '7.4',
    title: 'Managing Token Cost, Caching & Model Selection Basics',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Most hosted LLM APIs price by <em>tokens</em> — input tokens (the prompt, including any retrieved context or few-shot examples) and output tokens (the generated response), usually at different rates, with output tokens typically costing more per token than input. Understanding this pricing shape changes how you design a prompt: a long system prompt repeated on every single request, or unnecessarily verbose retrieved context, directly multiplies cost across every call.',
      '<em>Prompt caching</em> (offered by several providers) reduces cost and latency for requests that share a long, identical prefix — e.g. the same lengthy system prompt or retrieved document context repeated across many user requests — by reusing previously-processed computation for that shared prefix rather than reprocessing it from scratch each time. Structuring a prompt with the stable, reusable part first and the request-specific part last is what makes a request cache-eligible.',
      'Model selection is a cost/quality/latency trade-off, not a single "best" choice: a smaller, cheaper, faster model is often entirely sufficient for well-defined, narrow tasks (classification, simple extraction), while a larger, more expensive model earns its cost on tasks requiring more complex reasoning or broader world knowledge. A common production pattern is <em>model routing</em> — using a cheap, fast model to classify how complex a request is, then routing only the genuinely complex ones to a more expensive model.',
      'Tracking cost in production means logging token counts per request (both input and output), not just dollar totals — this is what lets you attribute cost spikes to a specific feature, prompt change, or usage pattern rather than discovering only an aggregate bill increase after the fact.',
      '<strong>Practical guidance:</strong> before optimizing for cost, measure it — log per-request token counts from day one of any LLM feature, even before cost becomes a concern, since retrofitting this logging after a cost problem appears means you have no historical data to diagnose what changed.',
    ],
    keyPoints: [
      'LLM APIs typically price input and output tokens separately, with output usually costing more per token — prompt length and response length both directly affect cost.',
      '<strong>Prompt caching</strong> reduces cost/latency for requests sharing a long identical prefix — structure prompts with stable content first, request-specific content last.',
      '<strong>Model routing</strong>: use a cheap model to classify request complexity, then route only complex requests to an expensive model.',
      'Log token counts per request from day one — this is what makes a later cost spike diagnosable rather than just an unexplained bill increase.',
      'Model selection is a cost/quality/latency trade-off matched to the task\'s actual complexity, not a single universally "best" choice.',
    ],
    code: `from openai import OpenAI

client = OpenAI()

def call_and_log_cost(prompt: str, model: str = "gpt-4o-mini") -> dict:
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )

    usage = response.usage
    # Log this per-request — the raw material for later cost attribution
    log_entry = {
        "model": model,
        "input_tokens": usage.prompt_tokens,
        "output_tokens": usage.completion_tokens,
        "total_tokens": usage.total_tokens,
    }
    print("USAGE_LOG:", log_entry)  # in production: send to your metrics system
    return log_entry


# --- Simple model routing based on estimated task complexity ---
def route_request(user_message: str) -> str:
    simple_indicators = ["yes or no", "classify", "true or false", "one word"]
    if any(phrase in user_message.lower() for phrase in simple_indicators):
        return "gpt-4o-mini"   # cheap, fast — sufficient for narrow tasks
    return "gpt-4o"            # reserve the larger model for complex requests


model_choice = route_request("Classify this review as positive or negative: ...")
call_and_log_cost("Classify this review as positive or negative: great product!", model=model_choice)
`,
    codeLabel: 'python',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Logging input/output token counts per request from the start is what turns "our bill went up" into "this specific feature\'s prompts got 3x longer after last week\'s change" — the difference between a diagnosable and undiagnosable cost increase.',
      tone: 'green',
    },
    quiz: {
      question: 'A team notices their monthly LLM API bill tripled but has no per-request token logging in place. What is the main consequence of this missing logging?',
      options: [
        { label: 'None — the total bill from the provider is sufficient to diagnose the cause', correct: false },
        { label: 'They cannot easily attribute the cost increase to a specific feature, prompt change, or usage pattern — only that costs rose overall', correct: true },
        { label: 'The provider will automatically explain the cause in the billing dashboard', correct: false },
        { label: 'Prompt caching becomes unavailable without this logging', correct: false },
      ],
      explanation: 'A total bill number says costs went up, but not why — without per-request token logging broken down by feature or prompt version, there\'s no data trail connecting the increase to its actual cause (e.g. a prompt that grew longer, a new feature calling the API more often, or a shift to a more expensive model). This is exactly why the lesson recommends logging from day one, before cost becomes a visible problem.',
    },
  },
  {
    id: '7.5',
    title: 'Lab: Building a Resume-to-JSON Extraction Service',
    duration: '20 min',
    kind: 'assignment',
    summary: [
      'This lab combines 7.2\'s structured output techniques and 7.3\'s reliability patterns into one working service: given unstructured resume text, return validated structured JSON containing name, skills, experience, and education.',
      'Define the target schema first as a Pydantic model with explicit types (e.g. <code>experience</code> as a list of structured entries with <code>company</code>, <code>title</code>, and <code>duration</code> fields, not a single free-text string) — a more specific schema constrains the model toward more consistent, more useful output, and makes downstream code that consumes this data far simpler than parsing free text.',
      'Wrap the extraction call with the reliability pattern from 7.3: a timeout, a bounded retry loop, and a re-prompt-with-validation-error path for schema failures specifically. Test your service deliberately against a messy, incomplete, or unusually-formatted resume (not just a clean example) to see the reliability layer actually earn its place — a clean input rarely reveals whether your error handling works.',
      'For the write-up: report what fraction of test resumes succeeded on the first attempt versus needed a retry, and look at what the retried cases had in common (unusual formatting? ambiguous section headers? missing fields entirely?) — this diagnostic habit, examining what specifically triggers your reliability layer, is exactly what Section 9.6\'s agent evaluation work asks you to do again at a larger scale.',
    ],
    keyPoints: [
      'Define a specific, structured Pydantic schema (nested fields, not free-text blobs) — this constrains model output and simplifies downstream consumption.',
      'Combine 7.2 (structured output) and 7.3 (reliability) into one pipeline: call → validate → re-prompt-on-failure → bounded retry → fallback.',
      'Test against messy/unusual inputs deliberately — clean inputs rarely exercise the reliability layer you just built.',
      'Track first-attempt success rate versus retry rate, and examine what characterizes the cases that needed a retry.',
      'This diagnostic habit — examining failure patterns, not just pass/fail counts — reappears at a larger scale in Section 9.6\'s agent evaluation.',
    ],
    code: `from pydantic import BaseModel, ValidationError
from openai import OpenAI
import time

client = OpenAI(timeout=10.0)


class Experience(BaseModel):
    company: str
    title: str
    duration: str

class Education(BaseModel):
    institution: str
    degree: str

class ResumeData(BaseModel):
    name: str
    skills: list[str]
    experience: list[Experience]
    education: list[Education]


EXTRACTION_PROMPT = """Extract structured data from this resume text.
Return JSON matching this exact structure: name, skills (list of strings),
experience (list of {{company, title, duration}}), education (list of {{institution, degree}}).

Resume:
{resume_text}"""


def extract_resume(resume_text: str, max_retries: int = 3) -> ResumeData:
    prompt = EXTRACTION_PROMPT.format(resume_text=resume_text)

    for attempt in range(max_retries):
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        raw_output = response.choices[0].message.content

        try:
            return ResumeData.model_validate_json(raw_output)
        except ValidationError as e:
            print(f"attempt {attempt + 1} failed validation: {e}")
            prompt = (
                f"{EXTRACTION_PROMPT.format(resume_text=resume_text)}\\n\\n"
                f"Your previous attempt was invalid: {e}\\nPlease correct the structure."
            )
            time.sleep(1)

    raise RuntimeError(f"Failed to extract valid resume data after {max_retries} attempts")


# Test deliberately against a messy, unusually-formatted resume
messy_resume = """
J. SMITH | Backend Eng | jsmith@email.com
worked at TechCorp doing backend stuff 2019-2022, then freelance since
skills: python, some kubernetes, sql
went to State U, studied comp sci, no degree listed clearly
"""
result = extract_resume(messy_resume)
print(result)
`,
    codeLabel: 'python',
    note: {
      label: 'DECISION POINT',
      text: 'If most retries in your test set cluster around one specific pattern (e.g. resumes without a clearly labeled education section), that\'s a signal to make the extraction prompt more explicit about that pattern — not just to keep raising the retry limit.',
      tone: 'green',
    },
    quiz: {
      question: 'While testing the extraction service, most first-attempt failures happen on resumes where the education section has no clear header (just floating text at the bottom). What is the better fix?',
      options: [
        { label: 'Increase max_retries so the model eventually gets it right by chance', correct: false },
        { label: 'Adjust the extraction prompt to explicitly address this pattern (e.g. instructing the model to look for education info even without a clear header), addressing the root cause rather than just retrying more', correct: true },
        { label: 'Remove the education field from the schema entirely to avoid the failures', correct: false },
        { label: 'Lower the timeout so failing attempts are detected faster', correct: false },
      ],
      explanation: 'A retry only helps with genuinely transient or self-correctable failures — if a specific input pattern reliably causes failures across many resumes, that\'s a systematic gap in the prompt\'s instructions, not randomness a retry will fix. Diagnosing and addressing the actual pattern (per the write-up\'s diagnostic habit) is more effective than raising a retry ceiling that just delays the same failure.',
    },
    crossRefs: ['7.2', '7.3'],
  },
  {
    id: '7.6',
    title: 'Fine-Tuning Approaches: Full Fine-Tuning vs. Parameter-Efficient Methods',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Every technique covered so far in this section (prompting, structured outputs, reliability patterns) works entirely by changing what you send to an unmodified, pretrained model. <em>Fine-tuning</em> is different: it actually updates a model\'s weights using a dataset of your own examples, so the desired behavior becomes baked into the model itself rather than something you have to re-specify in every prompt.',
      '<em>Full fine-tuning</em> updates all of a model\'s weights — this can produce the strongest adaptation to a specific task or style, but requires substantial compute and data, and, for a very large model, is rarely practical outside of organizations with significant training infrastructure. This course does not build full fine-tuning from scratch, consistent with the Section 1.1 framing that training large models is ML-engineering, not AI-engineering, territory.',
      '<em>Parameter-efficient fine-tuning (PEFT)</em> methods instead update only a small number of additional parameters while keeping the original model weights frozen. <em>LoRA (Low-Rank Adaptation)</em> inserts small, trainable low-rank matrices alongside a model\'s existing weight matrices, dramatically reducing the number of parameters that need training and storage while still adapting behavior meaningfully. <em>QLoRA</em> combines this with quantization (reducing the precision of the frozen base weights) to further reduce the memory required, making fine-tuning feasible on much more modest hardware. <em>Prefix-tuning</em> and <em>prompt-tuning</em> instead learn a small set of additional "virtual tokens" prepended to the input, without touching the model\'s weight matrices at all.',
      'The practical decision that matters for an AI engineer is not how to implement these methods from scratch, but when fine-tuning of any kind is worth reaching for at all: fine-tuning is well-suited to teaching a model a consistent style, format, or narrow domain vocabulary it doesn\'t reliably produce even with careful prompting — it is poorly suited to teaching a model new factual knowledge (which RAG, Section 8, handles far more cheaply and updatably) or to fixing a problem that better prompting or structured outputs (7.1, 7.2) can already solve.',
      '<strong>Practical guidance:</strong> the typical order of escalation for improving an LLM application\'s behavior is: better prompting first, then RAG if the gap is missing factual/contextual knowledge, and fine-tuning only after both of those have been tried and the gap is specifically about consistent style, format, or tone rather than knowledge — fine-tuning is usually the most expensive and slowest-to-iterate-on option of the three.',
    ],
    keyPoints: [
      '<strong>Fine-tuning</strong> updates model weights using your own examples; prompting only changes what you send to an unmodified model.',
      '<strong>Full fine-tuning</strong> updates all weights — strongest adaptation, most compute/data required, ML-engineering territory rather than typical AI-engineering work.',
      '<strong>PEFT methods (LoRA, QLoRA, prefix/prompt-tuning)</strong> update only a small number of additional parameters, dramatically reducing cost while still adapting behavior meaningfully.',
      'Fine-tuning suits teaching consistent style/format/narrow vocabulary; it is a poor tool for teaching new facts (RAG handles that more cheaply and updatably) or for problems better prompting can already solve.',
      'Escalation order: better prompting → RAG (for knowledge gaps) → fine-tuning (for style/format gaps), roughly in order of cost and iteration speed.',
    ],
    code: `# Conceptual illustration of what LoRA changes, not a runnable training script
# (an actual fine-tuning job is built in the 7.8 lab using a hosted API).

# Full fine-tuning: EVERY weight in a large weight matrix W is updated.
#   W_new = W_original + delta_W          # delta_W is the same huge size as W

# LoRA: W_original stays FROZEN. Instead, two small "low-rank" matrices
# A and B are trained, where their product approximates a useful delta:
#   W_effective = W_original + (A @ B)     # A, B are MUCH smaller than W
#
# If W_original is (4096 x 4096) = ~16.8 million parameters,
# a rank-8 LoRA adds only:
#   A: (4096 x 8) = 32,768 parameters
#   B: (8 x 4096) = 32,768 parameters
#   total trainable: ~65,536 parameters  -- a ~250x reduction

# QLoRA additionally quantizes W_original (e.g. to 4-bit precision) so even
# HOLDING the frozen base weights in memory during training is far cheaper,
# while A and B are still trained at higher precision.
`,
    codeLabel: 'python',
    note: {
      label: 'DECISION POINT',
      text: 'If a model keeps giving factually wrong answers about your company\'s specific policies, that\'s a knowledge gap — reach for RAG (Section 8), not fine-tuning. If it keeps ignoring your requested output format despite clear instructions, that\'s a style/format gap fine-tuning is actually suited to.',
      tone: 'green',
    },
    quiz: {
      question: 'A support-bot LLM frequently gives outdated answers about a company\'s current refund policy, which changes every few months. Is fine-tuning the model on the current policy text a good fix?',
      options: [
        { label: 'Yes — fine-tuning is the standard way to teach a model new facts', correct: false },
        { label: 'No — fine-tuning is poorly suited to frequently-changing factual knowledge, since each policy update would require re-running the fine-tuning job; RAG (Section 8) handles updatable factual grounding far more cheaply', correct: true },
        { label: 'Yes, but only using full fine-tuning, never LoRA', correct: false },
        { label: 'No — this problem cannot be solved by any technique covered in this course', correct: false },
      ],
      explanation: 'Fine-tuning bakes information into the model\'s weights at training time — updating it for a policy change means re-running the fine-tuning job every time the policy changes, which is slow and expensive. RAG instead retrieves current policy text at query time from a source that can be updated instantly, making it far better suited to frequently-changing factual content — this is exactly the "knowledge gap → RAG, not fine-tuning" guidance from this lesson.',
    },
    crossRefs: ['1.1'],
  },
  {
    id: '7.7',
    title: 'Choosing a Model: Hosted APIs vs. Open-Weight Self-Hosting',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Section 7.4 covered choosing between models of different sizes from the same provider; this lesson covers the broader decision of whether to call a hosted API at all, versus self-hosting an open-weight model (e.g. Llama, Mistral, or Qwen-class models) on your own infrastructure — a decision with cost, latency, privacy, and operational trade-offs that go beyond simple per-token pricing.',
      'Hosted APIs trade a per-token cost for eliminated operational burden: no GPU provisioning, no model-serving infrastructure (Section 12.3 covers what that infrastructure actually involves), and access to the largest, most capable models without owning the hardware needed to run them. This makes hosted APIs the default reasonable choice for most product teams, especially early on or at moderate request volume.',
      'Self-hosting an open-weight model becomes attractive as request volume grows very large (at high enough scale, the fixed cost of owned/reserved infrastructure can undercut per-token API pricing), when data cannot leave your infrastructure for compliance or contractual reasons (regulated industries, sensitive internal documents), or when you need to fine-tune (7.6) and control a model to a degree hosted providers don\'t expose.',
      'The trade-off isn\'t free even when the numbers favor self-hosting: it requires the model-serving expertise covered in Section 12.3 (batching, quantization, dedicated serving frameworks), ongoing infrastructure maintenance, and typically access to somewhat less capable models than the largest proprietary hosted options — open-weight models have narrowed this capability gap substantially but it has not fully closed for the most demanding tasks.',
      '<strong>Practical guidance:</strong> default to a hosted API until you have a concrete, specific reason not to (a hard compliance requirement, or measured request volume that makes the cost math clearly favor self-hosting) — this mirrors the "start simple, add complexity only when justified" pattern that runs throughout this course, from prompting-before-fine-tuning (7.6) to single-vector-store-before-hybrid-search (Section 8).',
    ],
    keyPoints: [
      '<strong>Hosted APIs</strong>: per-token cost, no infrastructure burden, access to the largest models — the reasonable default for most teams, especially at moderate scale.',
      '<strong>Self-hosting open-weight models</strong> becomes attractive at very high request volume, under data-residency/compliance constraints, or when deep fine-tuning control is needed.',
      'Self-hosting requires real model-serving expertise (Section 12.3) and ongoing infrastructure — the trade-off is not "free" even when the raw cost math favors it.',
      'Open-weight models have narrowed the capability gap with the largest proprietary models substantially, but a gap can still exist for the most demanding tasks.',
      'Default to a hosted API until a specific, concrete reason (compliance, measured scale economics, deep fine-tuning need) argues otherwise.',
    ],
    code: `# Rough framing for the hosted-vs-self-hosted cost comparison — the actual
# numbers change constantly, but the SHAPE of the trade-off is stable:

def rough_monthly_cost_hosted(requests_per_month, avg_tokens_per_request, price_per_1k_tokens):
    total_tokens = requests_per_month * avg_tokens_per_request
    return (total_tokens / 1000) * price_per_1k_tokens

def rough_monthly_cost_self_hosted(gpu_instance_monthly_cost, num_instances, ops_overhead_estimate):
    # Fixed cost regardless of request volume, plus the ops burden this
    # lesson emphasizes isn't captured in the raw dollar figure alone.
    return gpu_instance_monthly_cost * num_instances + ops_overhead_estimate


hosted_estimate = rough_monthly_cost_hosted(
    requests_per_month=2_000_000, avg_tokens_per_request=800, price_per_1k_tokens=0.15
)
self_hosted_estimate = rough_monthly_cost_self_hosted(
    gpu_instance_monthly_cost=3000, num_instances=2, ops_overhead_estimate=4000
)

print(f"hosted API estimate: \${hosted_estimate:,.0f}/month")
print(f"self-hosted estimate: \${self_hosted_estimate:,.0f}/month (before counting engineering time)")
# The crossover point depends entirely on YOUR volume and constraints —
# the point of this exercise is running the numbers explicitly, not
# defaulting to either option on instinct.
`,
    codeLabel: 'python',
    note: {
      label: 'DECISION POINT',
      text: 'If you can\'t point to a specific compliance requirement or a request-volume number that makes the cost math clearly favor self-hosting, you don\'t yet have a reason to leave a hosted API.',
      tone: 'green',
    },
    quiz: {
      question: 'A startup with modest request volume is deciding whether to self-host an open-weight model to save on API costs. What consideration does this lesson suggest they\'re most likely to be underweighting?',
      options: [
        { label: 'The per-token price of hosted APIs, which they should research more', correct: false },
        { label: 'The ongoing operational burden of model-serving infrastructure (Section 12.3) and engineering time — costs that don\'t show up in a simple per-token price comparison', correct: true },
        { label: 'Open-weight models are always strictly more capable than hosted proprietary ones', correct: false },
        { label: 'Self-hosting requires no additional infrastructure work beyond downloading model weights', correct: false },
      ],
      explanation: 'At modest request volume, the fixed operational cost of self-hosting (GPU infrastructure, serving frameworks, ongoing maintenance, and the engineering time all of that requires) is unlikely to be undercut by the savings versus a hosted API\'s per-token pricing — this operational overhead is easy to underweight when comparing only headline dollar-per-token figures.',
    },
    crossRefs: ['7.4', '7.6'],
  },
  {
    id: '7.8',
    title: 'Lab: Fine-Tuning a Model via a Hosted Fine-Tuning API',
    duration: '20 min',
    kind: 'assignment',
    summary: [
      'This lab makes 7.6\'s fine-tuning concepts concrete without requiring any training infrastructure of your own: prepare a small dataset and fine-tune a model using a hosted provider\'s fine-tuning API (which handles the LoRA/PEFT-style training internally), then compare its output against simply prompting the base model.',
      'Prepare a training dataset of input/output example pairs demonstrating a specific, consistent style or format — per 7.6\'s guidance, this lab deliberately picks a style/format task (e.g. always responding in a specific structured tone and format for customer support replies) rather than a knowledge task, since fine-tuning is the wrong tool for teaching facts.',
      'Submit the fine-tuning job via the provider\'s API, wait for it to complete, then run the same set of test prompts against both the fine-tuned model and the original base model with a carefully-crafted prompt attempting the same style — compare which one more consistently produces the desired format, and at what different cost (the fine-tuned model call itself, versus the extra prompt-engineering tokens spent on the base model each time).',
      'For the write-up: report whether the fine-tuned model\'s consistency improvement was worth the fine-tuning job\'s cost and the loss of prompt flexibility (a fine-tuned model is harder to quickly adjust than a prompt) — there often isn\'t a universally correct answer here, and stating your reasoning explicitly is the actual point of the exercise, consistent with this course\'s recurring emphasis on defensible, reasoned decisions over default choices.',
    ],
    keyPoints: [
      'Fine-tune via a hosted provider\'s API — no local training infrastructure required, matching this course\'s AI-engineering (not ML-engineering) scope.',
      'Choose a style/format consistency task for the training data, not a factual-knowledge task, per 7.6\'s guidance on what fine-tuning is actually suited for.',
      'Compare the fine-tuned model against the base model with careful prompting on the same test set — measure both consistency and total cost of each approach.',
      'A fine-tuned model trades prompt flexibility for baked-in consistency — this trade-off, not just the accuracy number, belongs in the final decision.',
      'The write-up\'s reasoning about whether the trade-off was worth it matters as much as the fine-tuning job itself.',
    ],
    code: `import json
from openai import OpenAI

client = OpenAI()

# --- Step 1: prepare training data — a STYLE/FORMAT task, not a knowledge task ---
training_examples = [
    {"messages": [
        {"role": "system", "content": "You are a support agent."},
        {"role": "user", "content": "My order hasn't arrived yet."},
        {"role": "assistant", "content": "I'm sorry for the delay! Let's look into this together — could you share your order number so I can check its status right away?"},
    ]},
    {"messages": [
        {"role": "system", "content": "You are a support agent."},
        {"role": "user", "content": "This product broke after one use."},
        {"role": "assistant", "content": "That's really frustrating, and I appreciate you flagging it. Let's get this sorted — could you tell me a bit about what happened so I can arrange a replacement or refund?"},
    ]},
    # ... a real fine-tuning job typically needs at least dozens of examples
]

with open("training_data.jsonl", "w") as f:
    for example in training_examples:
        f.write(json.dumps(example) + "\\n")

# --- Step 2: upload and submit the fine-tuning job ---
uploaded_file = client.files.create(file=open("training_data.jsonl", "rb"), purpose="fine-tune")
job = client.fine_tuning.jobs.create(training_file=uploaded_file.id, model="gpt-4o-mini-2024-07-18")
print(f"fine-tuning job submitted: {job.id} — poll job.status until 'succeeded'")

# --- Step 3 (after job completes): compare fine-tuned vs. base model ---
test_prompt = "My subscription charged me twice this month."

base_response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are a support agent. Always respond warmly, "
                                       "acknowledge frustration, and ask one clarifying question."},
        {"role": "user", "content": test_prompt},
    ],
)

finetuned_response = client.chat.completions.create(
    model=job.fine_tuned_model,  # populated once the job succeeds
    messages=[
        {"role": "system", "content": "You are a support agent."},  # note: shorter prompt needed
        {"role": "user", "content": test_prompt},
    ],
)

print("base model (with careful prompting):", base_response.choices[0].message.content)
print("fine-tuned model (shorter prompt):", finetuned_response.choices[0].message.content)
`,
    codeLabel: 'python',
    note: {
      label: 'WHEN TO USE',
      text: 'If the base model with careful prompting already achieves acceptably consistent output, the fine-tuning job\'s cost and reduced flexibility may not be worth it — this comparison is the actual point of the lab, not just running the job.',
      tone: 'green',
    },
    quiz: {
      question: 'After fine-tuning, the model produces consistent, on-brand replies with a much shorter system prompt than the base model needed to achieve similar consistency. What has fine-tuning effectively traded for what?',
      options: [
        { label: 'It traded accuracy for speed, with no other effect', correct: false },
        { label: 'It traded prompt flexibility and the ability to quickly adjust behavior for baked-in, more consistent style requiring less per-request prompt engineering', correct: true },
        { label: 'It eliminated the need for any system prompt at all under all circumstances', correct: false },
        { label: 'It made the model incapable of following any future instructions', correct: false },
      ],
      explanation: 'Fine-tuning bakes the desired style into the model\'s weights, which is why a shorter prompt achieves the same consistency — but this also means changing that style later requires another fine-tuning job rather than just editing a prompt, which is a real cost against the flexibility a prompt-only approach retains. This is exactly the trade-off the write-up is meant to weigh explicitly.',
    },
    crossRefs: ['7.6'],
  },
]
