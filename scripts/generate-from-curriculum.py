#!/usr/bin/env python3
"""
Curriculum-to-LessonData Generator
=====================================
Reads a course curriculum JSON file and calls an LLM to generate structured
Udemy-style study content for each lesson, then writes JavaScript lesson files
for the site.

Usage:
    python scripts/generate-from-curriculum.py <curriculum_file> [options]

Environment Variables:
    API_KEY / GEMINI_API_KEY / NVIDIA_API_KEY  (required unless --dry-run or --ollama)

Example:
    python scripts/generate-from-curriculum.py scripts/spring-batch-curriculum.json \
        --course-slug batch --workers 5
"""

import os
import sys
import re
import json
import time
import random
import threading
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from openai import OpenAI

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / '.env')

# ─── Configuration ──────────────────────────────────────────────────────────

MODEL        = os.environ.get("MODEL", "gemini-2.5-flash")
BASE_URL     = os.environ.get("BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "minimax-m3:cloud")
OLLAMA_HOST  = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_BASE_URL = f"{OLLAMA_HOST}/v1"
MAX_TOKENS   = 16384
TEMPERATURE  = 0.4   # slightly higher than transcript script — curriculum needs creative expansion
RETRY_DELAY  = 5
MAX_RETRIES  = 6
RPM_LIMIT    = int(os.environ.get("RPM_LIMIT", "35"))

COLOR_PALETTE = ['#5B8DEF', '#3FB68B', '#C96442', '#B57BEE', '#E0A63A', '#E1596B']

# ─── Rate Limiter ───────────────────────────────────────────────────────────

class RateLimiter:
    def __init__(self, rpm: int):
        self._interval = 60.0 / rpm
        self._lock = threading.Lock()
        self._last = 0.0

    def wait(self):
        with self._lock:
            now = time.time()
            elapsed = now - self._last
            if elapsed < self._interval:
                time.sleep(self._interval - elapsed)
            self._last = time.time()

_rate_limiter = None  # initialized in main()

# ─── System Prompt Template ─────────────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """You are an expert course author creating professional, Udemy-quality lecture content for a programming course.

TECHNICAL BASELINE — always use exactly these versions:
{technical_baseline}

RUNNING DOMAIN — use these entities and packages in all code examples:
{running_domain}

CONTINUITY RULES:
- Do NOT re-introduce or re-explain concepts that prior lessons in the sequence already covered.
- Reference earlier lessons naturally: "as we explored in lesson 2.3..." or "building on the ExecutionContext from lesson 2.3..."
- When the outline says "cross-reference X.Y", treat that lesson's content as already known to the student.
- Keep class names, package names, variable names, and code style consistent across all lessons in the section.
- The position in the course (section number, lesson ordinal) signals depth: foundation sections introduce, later sections extend.

VERSION AWARENESS:
- Stick to the technical baseline versions listed above.
- Clearly mark any features that only exist in a newer version — use a code comment (// Spring Batch 6.0+) or a dedicated callout.
- If an annotation or auto-configuration behavior changes between versions, flag it explicitly.

CODE REQUIREMENTS:
- All code must be syntactically correct and complete: full import statements, correct annotations, working method bodies.
- Use real framework API classes — never invent or simplify class names.
- Use the running domain entities in code examples wherever the concept is naturally demonstrated with them.
- Use modern Java idioms (records, text blocks, var) where they improve clarity.
- For multi-class examples, separate classes with: // ─── ClassName.java ───────────────────────
- For Spring Batch 5.x: JobBuilder and StepBuilder take a JobRepository constructor argument. Factories were removed. Example:
    new StepBuilder("loadStep", jobRepository)
        .chunk(500, transactionManager)
        .reader(reader())
        .processor(processor())
        .writer(writer())
        .build()
- chunk() takes (int chunkSize, PlatformTransactionManager transactionManager) in Spring Batch 5.x.

LESSON FORMAT — produce a JSON object with ALL of these fields:

"title": Clean lesson title — no numbering prefix, max 60 chars.

"duration": Estimated reading/study time. Use:
  "8 min" for concept overviews
  "12 min" for focused deep-dives
  "15 min" for multi-facet technical lessons
  "20 min" for complex architectural lessons or labs

"kind": One of: theory, concept, demo, assignment, summary, setup, faq
  theory   = architectural mental models, system design, trade-off analysis
  concept  = focused deep-dives into a single API or mechanism
  demo     = code-centric walkthroughs where the code IS the teaching
  assignment = hands-on lab exercises (set kind="assignment" for Lab lessons)
  summary  = section-closing recaps (rare)
  setup    = environment or project configuration
  faq      = gotcha/FAQ-style comparisons and anti-pattern explainers

"summary": Array of 3-5 paragraph strings. This IS the lesson — make it comprehensive.
  Structure:
    Paragraph 1: Motivation and context — why this topic matters, what problem it solves,
                 where it fits in the broader course arc.
    Paragraphs 2-3: The technical depth — the HOW and the WHY, not just the WHAT.
                    Explain the mechanics, the constraints, the failure modes.
    Final paragraph: Practical guidance — when to use, common pitfalls, version gotchas,
                     the decision the student will face in real work.
  Style:
    - Use <code> for class/method/annotation names inline.
    - Use <em> for key terms being introduced.
    - Use <strong> for important warnings or version-critical notes.
    - Write in direct second-person: "When you configure a JdbcCursorItemReader..."
    - No filler: avoid "in this lesson we will learn..." or "as we have seen..."
    - Assume the reader is a working Java engineer who values precision.

"keyPoints": Array of 4-7 bullet strings. Precise, actionable takeaways.
  - Use <strong> and <code> HTML tags where helpful.
  - Start each bullet with a verb or a clear noun phrase (not "The reader is...").
  - These should be the items a student writes in their notes.

"code": Complete, compilable code example demonstrating the lesson's core concept.
  - Include all import statements.
  - Use the running domain entities.
  - Show the single most instructive scenario — not everything mentioned in the summary.
  - For lab/assignment lessons: provide the full solution code.
  - Omit ONLY for purely conceptual lessons where code adds no value (this should be rare).

"codeLabel": One of: "java", "yaml", "xml", "sql", "properties", "terminal"

"note": An object with:
  "label": One of: KEY INSIGHT, WHY THIS MATTERS, WHEN TO USE, DECISION POINT, WARNING,
           COMMON PITFALL, VERSION NOTE
  "text": 1-2 sentences capturing the single most important insight to internalize.
  "tone": "accent" for warnings/pitfalls/version gotchas; "green" for positive insights/best practices.

"quiz": An object with:
  "question": A scenario-based question testing practical understanding, not trivia.
              Frame it around a real decision or a common mistake.
  "options": Array of exactly 4 objects: {"label": "...", "correct": bool}
             Exactly one option must have correct: true.
             Distractors should be plausible — not obviously wrong.
  "explanation": 2-3 sentences explaining why the correct answer is right
                 and briefly why each distractor is wrong.

COMMON PITFALLS POLICY:
Every lesson must address at least one common pitfall — either in the final summary paragraph,
in the note field, or both. Financial batch jobs surface version mismatches and threading bugs
loudly; call them out by name.

Return ONLY valid JSON. No markdown fences. No text before or after the JSON object."""


# ─── Curriculum Loader ──────────────────────────────────────────────────────

def load_curriculum(curriculum_path: Path) -> dict:
    """Load and validate the curriculum JSON file."""
    with open(curriculum_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    required = ['slug', 'title', 'sections']
    for key in required:
        if key not in data:
            print(f"ERROR: curriculum JSON missing required field: '{key}'")
            sys.exit(1)

    return data


def curriculum_to_sections_info(curriculum: dict) -> dict:
    """Convert curriculum JSON into the sections_info dict used by the generator."""
    sections_info = {}
    for section in curriculum['sections']:
        sec_id = section['id']
        sections_info[sec_id] = {
            'title': section['title'],
            'lessons': [
                {
                    'num': int(lesson['id'].split('.')[1]),
                    'id': lesson['id'],
                    'title': lesson['title'],
                    'description': lesson.get('description', ''),
                    'crossRefs': lesson.get('crossRefs', []),
                    'duration': _estimate_duration(lesson.get('description', '')),
                }
                for lesson in section['lessons']
            ]
        }
    return sections_info


def _estimate_duration(description: str) -> int:
    """Estimate lesson duration in minutes based on description length."""
    words = len(description.split())
    if words > 80:
        return 15
    elif words > 50:
        return 12
    else:
        return 8


# ─── Prompt Builders ────────────────────────────────────────────────────────

def build_course_map(curriculum: dict) -> str:
    """Build a compact course-map string for the LLM context."""
    lines = []
    for section in curriculum['sections']:
        lines.append(f"  Section {section['id']}: {section['title']}")
    return "\n".join(lines)


def build_section_context(section_title: str, all_lessons: list, current_id: str) -> str:
    """Build the section context block with the current lesson marked."""
    lines = [f"Section: {section_title}", "Lesson sequence in this section:"]
    for lesson in all_lessons:
        marker = "  ► " if lesson['id'] == current_id else "    "
        lines.append(f"{marker}{lesson['id']} {lesson['title']}")
    return "\n".join(lines)


def build_lesson_user_prompt(curriculum: dict, section: dict, lesson: dict,
                              course_map: str) -> str:
    """Build the full user prompt for a single lesson."""
    section_ctx = build_section_context(section['title'], section['lessons'], lesson['id'])

    cross_ref_note = ""
    if lesson.get('crossRefs'):
        refs = ", ".join(lesson['crossRefs'])
        cross_ref_note = f"\n\nCross-references (student has already studied these lessons): {refs}"

    return f"""Course: {curriculum['title']}

FULL COURSE MAP (for continuity awareness):
{course_map}

CURRENT {section_ctx}

LESSON TO GENERATE: {lesson['id']} — {lesson['title']}

Must cover:
{lesson['description']}{cross_ref_note}
"""


# ─── API Helpers ────────────────────────────────────────────────────────────

def _sanitize_llm_json(text: str) -> str:
    """Clean up LLM-generated JSON text so it can be parsed by json.loads()."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

    def _fix_json_string(m):
        s = m.group(0)
        inner = s[1:-1]
        inner = inner.replace('\r\n', '\\n')
        inner = inner.replace('\r', '\\n')
        inner = inner.replace('\n', '\\n')
        inner = inner.replace('\t', '\\t')
        inner = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', inner)
        return s[0] + inner + s[-1]

    text = re.sub(r'"(?:[^"\\]|\\.)*"', _fix_json_string, text, flags=re.DOTALL)
    return text


def call_api(client: OpenAI, system_prompt: str, user_prompt: str, lesson_id: str,
             model_override: str = None) -> dict:
    """Call the LLM API to generate lesson content from a curriculum entry."""
    model_to_use = model_override or MODEL

    for attempt in range(MAX_RETRIES):
        try:
            response_text = ""
            completion = client.chat.completions.create(
                model=model_to_use,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=TEMPERATURE,
                top_p=1,
                max_tokens=MAX_TOKENS,
                response_format={"type": "json_object"},
                stream=True,
            )

            for chunk in completion:
                if not getattr(chunk, "choices", None):
                    continue
                if len(chunk.choices) == 0 or getattr(chunk.choices[0], "delta", None) is None:
                    continue
                delta = chunk.choices[0].delta
                if getattr(delta, "content", None) is not None:
                    response_text += delta.content

            response_text = _sanitize_llm_json(response_text)
            return json.loads(response_text)

        except json.JSONDecodeError as e:
            print(f"    [{lesson_id}] WARN: JSON parse error on attempt {attempt + 1}: {e}")
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY * (2 ** attempt) + random.uniform(0, 2)
                print(f"    [{lesson_id}] Retrying in {delay:.0f}s...")
                time.sleep(delay)
            else:
                return {"title": lesson_id, "duration": "10 min", "kind": "concept",
                        "summary": ["[Content generation failed]"], "keyPoints": []}

        except Exception as e:
            is_rate_limit = "429" in str(e)
            print(f"    [{lesson_id}] WARN: {'Rate limited' if is_rate_limit else 'API error'} "
                  f"on attempt {attempt + 1}: {e}")
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY * (2 ** attempt) + random.uniform(0, 3)
                if is_rate_limit:
                    delay = max(delay, 25)
                print(f"    [{lesson_id}] Retrying in {delay:.0f}s...")
                time.sleep(delay)
            else:
                return {"title": lesson_id, "duration": "10 min", "kind": "concept",
                        "summary": ["[Content generation failed]"], "keyPoints": []}


# ─── JS Output Helpers ──────────────────────────────────────────────────────

def escape_js_string(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def format_js_array(items: list, indent: int = 6) -> str:
    if not items:
        return "[]"
    pad = " " * indent
    lines = [f"{pad}'{escape_js_string(str(item))}'," for item in items]
    return "[\n" + "\n".join(lines) + f"\n{' ' * (indent - 2)}]"


def generate_section_js(lessons: list) -> str:
    """Generate the JavaScript source for a section file."""
    entries = []
    for lesson in lessons:
        parts = []
        parts.append(f"    id: '{lesson['id']}',")
        parts.append(f"    title: '{escape_js_string(lesson['title'])}',")
        parts.append(f"    duration: '{escape_js_string(lesson['duration'])}',")
        parts.append(f"    kind: '{lesson.get('kind', 'concept')}',")

        summary = lesson.get('summary', [])
        parts.append(f"    summary: {format_js_array(summary, 6)},")

        key_points = lesson.get('keyPoints', [])
        if key_points:
            parts.append(f"    keyPoints: {format_js_array(key_points, 6)},")

        if lesson.get('code'):
            code_val = lesson['code']
            if not isinstance(code_val, str):
                code_val = json.dumps(code_val, indent=2) if isinstance(code_val, (dict, list)) else str(code_val)
            code_escaped = code_val.replace('`', '\\`').replace('${', '\\${')
            parts.append(f"    code: `{code_escaped}`,")
            if lesson.get('codeLabel'):
                parts.append(f"    codeLabel: '{escape_js_string(lesson['codeLabel'])}',")

        if lesson.get('note'):
            note = lesson['note']
            note_label = escape_js_string(note.get('label', 'NOTE'))
            note_text  = escape_js_string(note.get('text', ''))
            note_tone  = note.get('tone', 'accent')
            parts.append(f"    note: {{")
            parts.append(f"      label: '{note_label}',")
            parts.append(f"      text: '{note_text}',")
            parts.append(f"      tone: '{note_tone}',")
            parts.append(f"    }},")

        if lesson.get('quiz'):
            quiz = lesson['quiz']
            q_text  = escape_js_string(quiz.get('question', ''))
            q_expl  = escape_js_string(quiz.get('explanation', ''))
            parts.append(f"    quiz: {{")
            parts.append(f"      question: '{q_text}',")
            parts.append(f"      options: [")
            for opt in quiz.get('options', []):
                opt_label   = escape_js_string(opt.get('label', ''))
                opt_correct = 'true' if opt.get('correct') else 'false'
                parts.append(f"        {{ label: '{opt_label}', correct: {opt_correct} }},")
            parts.append(f"      ],")
            parts.append(f"      explanation: '{q_expl}',")
            parts.append(f"    }},")

        entries.append("  {\n" + "\n".join(parts) + "\n  }")

    return "export default [\n" + ",\n".join(entries) + ",\n]\n"


def generate_sections_js(sections_meta: list) -> str:
    lines = ["// Section metadata — auto-generated from curriculum", "export const sectionMeta = ["]
    for sec in sections_meta:
        color   = sec.get('color') or COLOR_PALETTE[(sec['id'] - 1) % len(COLOR_PALETTE)]
        optional = 'true' if sec.get('optional', False) else 'false'
        title   = escape_js_string(sec['title'])
        lines.append(f"  {{ id: {sec['id']},  title: '{title}', optional: {optional}, color: '{color}' }},")
    lines.append("]")
    return "\n".join(lines) + "\n"


def generate_glossary_js(glossary_terms: list) -> str:
    lines = ["// Glossary — auto-generated from curriculum", "export const glossary = ["]
    for term in glossary_terms:
        t = escape_js_string(term['term'])
        d = escape_js_string(term['def'])
        lines.append(f"  {{ term: '{t}', def: '{d}' }},")
    lines.append("]")
    return "\n".join(lines) + "\n"


# ─── Glossary Generation ────────────────────────────────────────────────────

GLOSSARY_PROMPT = """You are extracting a glossary of technical terms from a programming course.

Given the lesson summaries and key points below, produce a JSON array of glossary entries.
Each entry has:
- "term": The term or concept name (capitalize properly)
- "def": A concise 1-2 sentence definition suitable for a quick-reference glossary

Rules:
- Extract 25-45 of the most important, course-specific terms (APIs, classes, annotations, protocols, patterns, tools).
- Do NOT include generic programming terms (variable, loop, class) unless they have a domain-specific meaning.
- Sort alphabetically by term.
- Deduplicate — if a term appears in multiple lessons, write one unified definition.
- Definitions should be self-contained.

Return ONLY a valid JSON array. No markdown fences, no extra text."""


def _load_lessons_from_existing_js(lessons_dir: Path, exclude_sections: set) -> dict:
    extra = {}
    for f in sorted(lessons_dir.glob("section*.js")):
        m = re.match(r'section(\d+)\.js', f.name)
        if not m:
            continue
        sec_n = int(m.group(1))
        if sec_n in exclude_sections:
            continue
        try:
            raw = f.read_text(encoding='utf-8')
            ids      = re.findall(r"id:\s*'(\d+\.\d+)'", raw)
            titles_r = re.findall(r"title:\s*'((?:[^'\\]|\\.)*)'", raw)
            titles   = [t.replace("\\'", "'") for t in titles_r]
            long_str = re.findall(r"'((?:[^'\\]|\\.){40,})'", raw)
            lessons_out = []
            per = max(1, len(long_str) // max(len(ids), 1))
            for i, lid in enumerate(ids):
                chunk = long_str[i * per: (i + 1) * per]
                lessons_out.append({
                    "id": lid,
                    "title": titles[i] if i < len(titles) else lid,
                    "summary": [s.replace("\\n", " ").replace("\\'", "'") for s in chunk],
                    "keyPoints": [],
                })
            if lessons_out:
                extra[sec_n] = lessons_out
        except Exception as e:
            print(f"  [WARN] Could not load section {sec_n} for glossary: {e}")
    return extra


def _parse_existing_sections_meta(sections_file: Path) -> list:
    content = sections_file.read_text(encoding='utf-8')
    entries = []
    for m in re.finditer(
        r"\{\s*id:\s*(\d+),\s*title:\s*'([^']*)',\s*optional:\s*(true|false),\s*color:\s*'([^']*)'\s*\}",
        content
    ):
        entries.append({
            "id": int(m.group(1)),
            "title": m.group(2).replace("\\'", "'"),
            "optional": m.group(3) == "true",
            "color": m.group(4),
        })
    return entries


def _generate_glossary(client: OpenAI, all_lessons: dict, course_title: str,
                        model: str = None) -> list:
    context_parts = [f"Course: {course_title}\n"]
    for sec_num in sorted(all_lessons.keys()):
        for lesson in all_lessons[sec_num]:
            title      = lesson.get('title', '')
            summary    = ' '.join(lesson.get('summary', []))
            key_points = ' | '.join(lesson.get('keyPoints', []))
            if summary.startswith('[Content generation failed') and not key_points:
                continue
            context_parts.append(f"[{lesson.get('id', '')}] {title}: {summary} Key points: {key_points}")

    combined = "\n".join(context_parts)
    if len(combined) > 60000:
        combined = combined[:60000] + "\n... (truncated)"

    _rate_limiter.wait()
    try:
        response_text = ""
        completion = client.chat.completions.create(
            model=model or MODEL,
            messages=[
                {"role": "system", "content": GLOSSARY_PROMPT},
                {"role": "user", "content": combined},
            ],
            temperature=0.2,
            max_tokens=MAX_TOKENS,
            stream=True,
        )
        for chunk in completion:
            if not getattr(chunk, "choices", None):
                continue
            if len(chunk.choices) == 0 or getattr(chunk.choices[0], "delta", None) is None:
                continue
            delta = chunk.choices[0].delta
            if getattr(delta, "content", None) is not None:
                response_text += delta.content

        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = re.sub(r'^```(?:json)?\s*', '', response_text)
            response_text = re.sub(r'\s*```$', '', response_text)

        result = json.loads(response_text)
        if isinstance(result, dict):
            terms = result.get("glossary") or result.get("terms") or next(iter(result.values()), [])
        else:
            terms = result

        if isinstance(terms, list) and len(terms) > 0:
            valid = [t for t in terms if isinstance(t, dict) and 'term' in t and 'def' in t]
            if valid:
                return sorted(valid, key=lambda t: t['term'].lower())

    except Exception as e:
        print(f"  [WARN] Glossary generation failed: {e}")

    return [
        {"term": "BatchStatus", "def": "The JVM-level state machine for a job or step execution (STARTED, FAILED, COMPLETED, etc.)."},
        {"term": "ChunkListener", "def": "A lifecycle listener that receives callbacks before and after each chunk transaction."},
        {"term": "ExecutionContext", "def": "A key-value store persisted to the JobRepository after each chunk commit, used to resume after a restart."},
        {"term": "ExitStatus", "def": "A customizable string returned by a step, used by conditional flow transitions (.on()) to route the job."},
        {"term": "FaultTolerant Step", "def": "A chunk step configured with .faultTolerant() that supports skip, retry, and no-rollback exception policies."},
        {"term": "JobInstance", "def": "A logical run of a job identified by its JobParameters; identical parameters produce the same JobInstance."},
        {"term": "JobParametersIncrementer", "def": "Adds or increments a parameter (e.g., run.id) so each scheduled trigger creates a fresh JobInstance."},
        {"term": "JobRepository", "def": "The persistence layer for all batch metadata — job/step executions, status, ExecutionContext."},
        {"term": "Partitioner", "def": "Returns a Map<String, ExecutionContext> dividing a dataset into parallel chunks for local or remote partitioning."},
        {"term": "StepExecution", "def": "One physical attempt of a step within a JobExecution; tracks read/write/skip/rollback counts."},
        {"term": "TaskExecutorPartitionHandler", "def": "Runs slave steps in a local thread pool for Architecture 2 (local partitioning)."},
    ]


def generate_registry_snippet(slug: str, title: str, section_count: int) -> str:
    imports = [
        f"import {{ sectionMeta as {slug}Sections }} from './{slug}-sections'",
        f"import {{ glossary as {slug}Glossary }} from './{slug}-glossary'",
    ]
    for i in range(1, section_count + 1):
        imports.append(f"import {slug}{i:02d} from './{slug}-lessons/section{i:02d}'")

    map_entries = ", ".join([f"{i}: {slug}{i:02d}" for i in range(1, section_count + 1)])
    registry_entry = f"""  {{
    slug: '{slug}',
    title: '{escape_js_string(title)}',
    subtitle: 'Study Guide',
    description: 'Generated from curriculum outline.',
    color: '#E0A63A',
    tags: ['Java', 'Spring', 'Batch'],
    sectionMeta: {slug}Sections,
    lessonsBySection: {{ {map_entries} }},
    glossary: {slug}Glossary,
  }}"""

    return ("\n".join(imports) + "\n\n" +
            f"const {slug}LessonsBySection = {{ {map_entries} }}\n\n" +
            f"// Add this to the courseDefs array:\n{registry_entry}")


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate site lesson data from a curriculum JSON file"
    )
    parser.add_argument("curriculum_file",
                        help="Path to a course curriculum JSON file (e.g. scripts/spring-batch-curriculum.json)")
    parser.add_argument("--course-slug", default=None,
                        help="URL-safe course identifier (overrides curriculum JSON 'slug' field)")
    parser.add_argument("--course-title", default=None,
                        help="Course title (overrides curriculum JSON 'title' field)")
    parser.add_argument("--output-dir", default=None,
                        help="Output directory (default: src/data/ relative to project root)")
    parser.add_argument("--sections", default=None,
                        help="Comma-separated section numbers to process (e.g., '2,3,4'). Default: all")
    parser.add_argument("--workers", type=int, default=3,
                        help="Number of parallel API calls per section (default: 3)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show plan without calling the API")
    parser.add_argument("--ollama", action="store_true",
                        help="Use local Ollama server instead of the remote API")
    parser.add_argument("--force", action="store_true",
                        help="Regenerate sections even if output files already exist")
    parser.add_argument("--glossary-only", action="store_true",
                        help="Skip lesson generation; regenerate glossary from existing section files")
    args = parser.parse_args()

    # Load curriculum
    curriculum_path = Path(args.curriculum_file)
    if not curriculum_path.is_file():
        print(f"ERROR: Curriculum file not found: {curriculum_path}")
        sys.exit(1)

    curriculum = load_curriculum(curriculum_path)

    # Resolve slug/title (CLI overrides curriculum JSON)
    slug         = args.course_slug  or curriculum.get('slug', 'course')
    course_title = args.course_title or curriculum.get('title', 'Course')

    # API key
    api_key = os.environ.get("API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("NVIDIA_API_KEY")
    if not api_key and not args.dry_run and not args.ollama:
        print("ERROR: No API key found. Set API_KEY, GEMINI_API_KEY, or NVIDIA_API_KEY in .env")
        sys.exit(1)

    project_root = Path(__file__).resolve().parent.parent
    output_dir   = Path(args.output_dir) if args.output_dir else project_root / "src" / "data"
    lessons_dir  = output_dir / f"{slug}-lessons"

    # Build sections_info from curriculum
    sections_info = curriculum_to_sections_info(curriculum)

    # Filter if --sections requested
    if args.sections:
        selected = set(int(x.strip()) for x in args.sections.split(","))
        sections_info = {k: v for k, v in sections_info.items() if k in selected}

    if not sections_info:
        print("ERROR: No sections found to process.")
        sys.exit(1)

    use_ollama   = args.ollama
    active_model = OLLAMA_MODEL if use_ollama else MODEL
    backend_lbl  = "Ollama (local)" if use_ollama else f"API ({BASE_URL})"

    total_lessons = sum(len(s['lessons']) for s in sections_info.values())

    print(f"\n{'=' * 60}")
    print(f"  Curriculum -> Lesson Generator")
    print(f"{'=' * 60}")
    print(f"  Course slug:   {slug}")
    print(f"  Course title:  {course_title}")
    print(f"  Curriculum:    {curriculum_path}")
    print(f"  Backend:       {backend_lbl}")
    print(f"  Model:         {active_model}")
    print(f"  Output dir:    {output_dir}")
    print(f"  Sections:      {sorted(sections_info.keys())}")
    print(f"  Total lessons: {total_lessons}")
    print(f"  Workers:       {args.workers}")
    print(f"{'=' * 60}\n")

    if args.dry_run:
        print("[DRY RUN] Would generate the following lessons:")
        for sec_num in sorted(sections_info.keys()):
            sec = sections_info[sec_num]
            print(f"\n  Section {sec_num}: {sec['title']}")
            for lesson in sec['lessons']:
                print(f"    {lesson['id']} {lesson['title']}")
        print("\n[DRY RUN] No API calls made. Remove --dry-run to generate content.")
        return

    # Build system prompt from curriculum metadata
    tech_baseline = curriculum.get('technicalBaseline', 'Java 21 / Spring Boot 3.x')
    running_domain = curriculum.get('runningDomain', 'Generic domain — use sensible example entities.')
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        technical_baseline=tech_baseline,
        running_domain=running_domain,
    )

    # Initialize API client and rate limiter
    global _rate_limiter
    _rate_limiter = RateLimiter(RPM_LIMIT)

    if use_ollama:
        client = OpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")
        print(f"[INFO] Using Ollama at {OLLAMA_HOST}, model: {OLLAMA_MODEL}")
    else:
        client = OpenAI(base_url=BASE_URL, api_key=api_key)
    print(f"[INFO] Rate limiter: {RPM_LIMIT} req/min\n")

    lessons_dir.mkdir(parents=True, exist_ok=True)

    # Pre-compute course map (used in every lesson prompt)
    course_map = build_course_map(curriculum)

    # Build a lookup: section id -> full section dict (with all lessons including description)
    section_lookup = {s['id']: s for s in curriculum['sections']}

    # ─── Glossary-only mode ──────────────────────────────────────────────
    if args.glossary_only:
        all_sections = _load_lessons_from_existing_js(lessons_dir, exclude_sections=set())
        if not all_sections:
            print(f"[ERROR] No existing section files found in {lessons_dir}")
            sys.exit(1)
        print(f"[INFO] Generating glossary from {len(all_sections)} existing section(s)...")
        glossary_terms = _generate_glossary(client, all_sections, course_title,
                                             model=active_model if use_ollama else None)
        glossary_js   = generate_glossary_js(glossary_terms)
        glossary_file = output_dir / f"{slug}-glossary.js"
        glossary_file.write_text(glossary_js, encoding='utf-8')
        print(f"✓ Written: {glossary_file} ({len(glossary_terms)} terms)")
        return

    all_generated_lessons = {}

    # ─── Worker function ─────────────────────────────────────────────────
    def process_lesson(lesson_info, sec_num):
        lesson_id = lesson_info['id']
        title     = lesson_info['title']

        # Enrich with original curriculum description
        curriculum_section = section_lookup.get(sec_num, {})
        curriculum_lessons = curriculum_section.get('lessons', [])
        original = next((l for l in curriculum_lessons if l['id'] == lesson_id), None)

        if original:
            lesson_info = {**lesson_info, **original}  # merge curriculum fields

        user_prompt = build_lesson_user_prompt(curriculum, {
            'title': sections_info[sec_num]['title'],
            'lessons': sections_info[sec_num]['lessons'],
        }, lesson_info, course_map)

        print(f"    [{lesson_id}] Generating...", flush=True)
        _rate_limiter.wait()
        result = call_api(client, system_prompt, user_prompt, lesson_id,
                          model_override=active_model if use_ollama else None)
        print(f"    [{lesson_id}] ✓ Done", flush=True)

        # Normalize summary / keyPoints
        raw_summary = result.get("summary", [])
        if isinstance(raw_summary, str):
            raw_summary = [raw_summary]
        elif not isinstance(raw_summary, list):
            raw_summary = [str(raw_summary)]

        raw_kp = result.get("keyPoints", [])
        if isinstance(raw_kp, str):
            raw_kp = [raw_kp]
        elif not isinstance(raw_kp, list):
            raw_kp = [str(raw_kp)]

        lesson_obj = {
            "id":       lesson_id,
            "title":    result.get("title", title),
            "duration": result.get("duration", f"{lesson_info['duration']} min"),
            "kind":     result.get("kind", "concept"),
            "summary":  raw_summary,
            "keyPoints": raw_kp,
        }
        for field in ("code", "codeLabel", "note", "quiz"):
            if result.get(field):
                lesson_obj[field] = result[field]

        return lesson_obj

    # Process sections one at a time, lessons in parallel within each section
    completed_sections = 0
    failed_section     = None

    for sec_num in sorted(sections_info.keys()):
        sec          = sections_info[sec_num]
        section_file = lessons_dir / f"section{sec_num:02d}.js"

        if section_file.exists() and not args.force:
            print(f"\n{'─' * 50}")
            print(f"  Section {sec_num}: {sec['title']} — SKIPPED (already exists)")
            print(f"  Use --force to regenerate.")
            print(f"{'─' * 50}")
            completed_sections += 1
            continue

        print(f"\n{'─' * 50}")
        print(f"  Section {sec_num}: {sec['title']} ({len(sec['lessons'])} lessons)")
        print(f"{'─' * 50}")

        results_map      = {}
        section_aborted  = False

        try:
            with ThreadPoolExecutor(max_workers=args.workers) as executor:
                future_to_lesson = {
                    executor.submit(process_lesson, lesson_info, sec_num): lesson_info
                    for lesson_info in sec['lessons']
                }
                for future in as_completed(future_to_lesson):
                    lesson_info = future_to_lesson[future]
                    try:
                        lesson_obj = future.result()
                        lesson_num = int(lesson_info['id'].split('.')[1])
                        results_map[lesson_num] = lesson_obj
                    except Exception as e:
                        lid = lesson_info['id']
                        print(f"    [{lid}] ERROR: {e}")
                        lesson_num = int(lid.split('.')[1])
                        results_map[lesson_num] = {
                            "id": lid,
                            "title": lesson_info['title'],
                            "duration": f"{lesson_info['duration']} min",
                            "kind": "concept",
                            "summary": [f"[Generation failed: {e}]"],
                            "keyPoints": [],
                        }
        except (KeyboardInterrupt, Exception) as e:
            print(f"\n  [ABORT] Section {sec_num} interrupted: {e}")
            failed_section  = sec_num
            section_aborted = True

        if section_aborted:
            break

        section_lessons = [
            results_map[int(li['id'].split('.')[1])]
            for li in sec['lessons']
            if int(li['id'].split('.')[1]) in results_map
        ]

        all_generated_lessons[sec_num] = section_lessons
        section_js = generate_section_js(section_lessons)
        section_file.write_text(section_js, encoding='utf-8')
        completed_sections += 1
        print(f"\n  ✓ Written: {section_file}")

    # ─── Post-processing ──────────────────────────────────────────────────

    sections_meta = []
    for sec_num in sorted(sections_info.keys()):
        sections_meta.append({
            "id":    sec_num,
            "title": sections_info[sec_num]["title"],
            "optional": False,
        })

    sections_file = output_dir / f"{slug}-sections.js"
    if sections_file.exists():
        existing_meta = _parse_existing_sections_meta(sections_file)
        merged = {m['id']: m for m in existing_meta}
        for m in sections_meta:
            merged[m['id']] = m
        sections_meta = [merged[k] for k in sorted(merged.keys())]

    sections_file.write_text(generate_sections_js(sections_meta), encoding='utf-8')
    print(f"\n✓ Written: {sections_file}")

    if all_generated_lessons:
        existing = _load_lessons_from_existing_js(lessons_dir, set(all_generated_lessons.keys()))
        all_content = {**existing, **all_generated_lessons}
        print(f"\n[INFO] Generating glossary from {len(all_content)} section(s)...")
        model_name = active_model if use_ollama else MODEL
        glossary_terms = _generate_glossary(client, all_content, course_title, model=model_name)
        glossary_js    = generate_glossary_js(glossary_terms)
        glossary_file  = output_dir / f"{slug}-glossary.js"
        glossary_file.write_text(glossary_js, encoding='utf-8')
        print(f"✓ Written: {glossary_file} ({len(glossary_terms)} terms)")
    else:
        print(f"\n[INFO] No new lessons generated — skipping glossary update.")

    total_on_disk = len(list(lessons_dir.glob("section*.js")))
    print(f"\n{'=' * 60}")
    print(f"  REGISTRATION SNIPPET")
    print(f"{'=' * 60}\n")
    print(generate_registry_snippet(slug, course_title, total_on_disk))

    print(f"\n{'=' * 60}")
    if failed_section:
        remaining = [s for s in sorted(sections_info.keys()) if s >= failed_section]
        print(f"  PARTIAL: {completed_sections}/{len(sections_info)} sections done.")
        print(f"  Remaining: {remaining}")
        print(f"  Re-run the same command to resume.")
    else:
        print(f"  DONE! {total_lessons} lessons across {len(sections_info)} sections.")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
