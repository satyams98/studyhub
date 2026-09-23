#!/usr/bin/env python3
"""
Transcript-to-LessonData Generator
===================================
Reads transcript .txt files from a folder, calls the NVIDIA API (OpenAI-compatible)
to generate structured study content, and writes JavaScript lesson files for the site.

Usage:
    python scripts/generate-from-transcripts.py <transcript_folder> [--course-slug <slug>]

Environment Variables:
    NVIDIA_API_KEY  - Your NVIDIA API key (required)

Example:
    set NVIDIA_API_KEY=nvapi-xxxxx
    python scripts/generate-from-transcripts.py "C:/path/to/transcripts/output" --course-slug webflux
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

# Load .env from project root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / '.env')

# ─── Configuration ──────────────────────────────────────────────────────────

MODEL = os.environ.get("MODEL", "gemini-2.5-flash")
BASE_URL = os.environ.get("BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "minimax-m3:cloud")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_BASE_URL = f"{OLLAMA_HOST}/v1"  # Ollama's OpenAI-compatible endpoint
MAX_TOKENS = 16384
TEMPERATURE = 0.3  # Low for factual accuracy — transcript provides all content
RETRY_DELAY = 5  # base seconds between retries (exponential backoff)
MAX_RETRIES = 6
RPM_LIMIT = int(os.environ.get("RPM_LIMIT", "35"))  # requests per minute (stay under actual limit)


# ─── Rate Limiter ───────────────────────────────────────────────────────────

class RateLimiter:
    """Thread-safe rate limiter enforcing max N requests per 60 seconds."""
    def __init__(self, rpm: int):
        self._interval = 60.0 / rpm
        self._lock = threading.Lock()
        self._last = 0.0

    def wait(self):
        with self._lock:
            now = time.time()
            elapsed = now - self._last
            if elapsed < self._interval:
                sleep_time = self._interval - elapsed
                time.sleep(sleep_time)
            self._last = time.time()


_rate_limiter = None  # initialized in main()

COLOR_PALETTE = ['#5B8DEF', '#3FB68B', '#C96442', '#B57BEE', '#E0A63A', '#E1596B']

SYSTEM_PROMPT = """You are converting a video course transcript into structured lesson data for a study guide website.

You will receive:
1. The SECTION CONTEXT — the section title and the full ordered list of lessons in this section, with the current lesson marked (►). Use this to understand where the lesson fits in the learning flow.
2. The TRANSCRIPT of the current lesson.

CONTINUITY RULES:
- Do NOT repeat introductions or re-explain concepts that earlier lessons in the sequence would have already covered.
- If this lesson builds on a previous one (e.g., "Part 2", "Demo", "Integration Tests"), write the summary assuming the reader has already studied the prior lessons.
- If this is the FIRST lesson in the section, you may provide broader context/motivation.
- If this is a SUMMARY lesson, synthesize the section's key ideas rather than introducing new ones.
- Reference earlier lessons naturally (e.g., "Building on the repository from the previous lesson...") when the transcript implies continuity.
- Maintain consistent naming across lessons in the same section. If an earlier lesson defines an entity (e.g., Customer in package "section02.entity"), later lessons must use the same names, packages, and conventions.
- When showing code that builds on prior lessons, include only the NEW code. Add a brief comment (e.g., "// ... (Customer entity from lesson 3.5)") for context.

KNOWLEDGE BRIDGING:
- If the instructor assumes prior knowledge (e.g., "as you know, publisher-subscriber pattern..."), briefly explain the assumed concept in 1-2 sentences so the summary is self-contained.
- If the instructor mentions a class, annotation, or API without explaining it, add a brief parenthetical clarification (e.g., "ParameterizedTypeReference (needed because Java's type erasure prevents passing List<Product>.class directly)").
- Link concepts to broader patterns when natural (e.g., connect backpressure to flow control, connect SSE to HTTP chunked transfer encoding).

CODE RECONSTRUCTION:
- The transcript is auto-generated speech — the instructor verbally describes code as they type it on screen.
- Reconstruct complete, compilable code from what the instructor describes. Include imports, annotations, class structure, and method bodies.
- If the instructor shows a test, include the full test method with assertions.
- Show the most instructive snippet, not necessarily everything mentioned. Ensure the code compiles — never leave placeholders or TODO stubs.
- If the instructor makes a verbal mistake or shortcut in naming, produce the corrected, idiomatic version.

CODE CORRECTNESS:
- Verify that code examples are logically consistent. For reactive test code, ensure StepVerifier chains use expectNext/assertNext/expectNextCount correctly (they consume items — do not double-count or combine incompatible assertions).
- Ensure annotations match their imports (e.g., @Id from org.springframework.data.annotation, not javax.persistence).
- If the instructor demonstrates an anti-pattern, clearly mark it as such in the summary before showing the correct version.

For the given transcript, produce a JSON object with these fields:
- "title": A clean, descriptive lesson title (remove file numbering prefixes)
- "duration": Reading time estimate as a string (e.g., "5 min")
- "kind": One of: theory, concept, demo, assignment, solution, faq, summary, setup
- "summary": Array of 2-4 paragraph strings capturing the key content. Be thorough — this replaces watching the video. Write in a direct, practical tone. Explain *why*, not just *what*. You may use <code> for class/method names and <em> for emphasis within summary text.
- "keyPoints": Array of 3-6 concise bullet point strings summarizing takeaways. You may use <strong>, <code>, <a href> HTML tags for emphasis and links.
- "code": Reconstruct a complete, compilable code snippet from what the instructor describes or demonstrates. Include this for ANY lesson where the instructor writes, shows, or discusses specific code. Omit ONLY for purely conceptual/FAQ lessons with no code content.
- "codeLabel": (only if code is provided) Label for the code block (e.g., "java", "terminal", "yaml", "properties")
- "note": An object with "label" (short uppercase heading), "text" (1-2 sentences), and "tone" ("accent" or "green"). Include for every lesson. Choose a label from: "KEY INSIGHT" (conceptual aha-moment), "WHY THIS MATTERS" (motivation/context), "WHEN TO USE" (practical guidance), "DECISION POINT" (choice the learner should make), "WARNING" (common pitfall).
- "quiz": (optional but encouraged) A self-check question to reinforce the lesson. Object with "question" (string), "options" (array of {"label": string, "correct": boolean} — exactly one correct), and "explanation" (string explaining the correct answer). Frame questions around practical decisions or common mistakes, not trivia.

ASSIGNMENT-SPECIFIC RULES:
- For ASSIGNMENT lessons: The transcript is often short — the instructor gives a task then shows the solution.
- Extract: (1) the exact assignment requirements, (2) hints about which APIs/features to use, (3) the complete solution code.
- Structure the summary as: first paragraph = what to build and requirements, second paragraph = solution walkthrough with explanation.
- Always include the solution code in the "code" field.

Guidelines:
- Include enough detail that someone can learn the material without watching the video.
- Do NOT include filler phrases like "in this video we will..." — distill the actual teaching.
- Use proper technical terminology.
- If the transcript is about an assignment, set kind to "assignment" and summarize what needs to be built.
- If it's a summary/recap lesson, set kind to "summary".
- If it's project/environment setup, set kind to "setup".
- If it discusses FAQ-style questions, set kind to "faq".
- For live demos/coding walkthroughs, set kind to "demo".

Return ONLY valid JSON. No markdown fences, no explanation outside the JSON."""

# ─── Helpers ────────────────────────────────────────────────────────────────

def parse_contents_file(contents_path: Path) -> dict:
    """Parse CONTENTS.txt to extract section titles and lesson metadata."""
    sections = {}  # {section_num: {"title": str, "lessons": [{num, title, duration}]}}
    current_section = None

    with open(contents_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            # Section header: "2. Architectural Shift: Blocking I/O vs Reactive Web"
            sec_match = re.match(r'^(\d+)\.\s+(.+)$', line)
            if sec_match and not re.match(r'^\d+\.\d+', line):
                sec_num = int(sec_match.group(1))
                sec_title = sec_match.group(2).strip()
                sections[sec_num] = {"title": sec_title, "lessons": []}
                current_section = sec_num
                continue

            # Lesson line: "2.3 Traditional vs Reactive API [9 min, 10/6/2024]"
            lesson_match = re.match(r'^(\d+)\.(\d+)\s+(.+?)\s*\[(\d+)\s*min', line)
            if lesson_match:
                sec_num = int(lesson_match.group(1))
                lesson_num = int(lesson_match.group(2))
                title = lesson_match.group(3).strip()
                duration = int(lesson_match.group(4))
                if sec_num not in sections:
                    sections[sec_num] = {"title": f"Section {sec_num}", "lessons": []}
                sections[sec_num]["lessons"].append({
                    "num": lesson_num,
                    "title": title,
                    "duration": duration,
                })

    return sections


def find_transcript_file(folder: Path, section_num: int, lesson_num: int, title: str) -> Path | None:
    """Find the transcript file for a given section/lesson number."""
    # Try exact pattern: "2.3 Traditional vs Reactive API.txt"
    prefix = f"{section_num}.{lesson_num} "
    for f in folder.iterdir():
        if f.name.startswith(prefix) and f.suffix == '.txt':
            return f
    return None


def classify_kind(title: str) -> str:
    """Pre-classify lesson kind from title hints."""
    lower = title.lower()
    if 'assignment' in lower or '---' in title:
        return 'assignment'
    if 'summary' in lower:
        return 'summary'
    if 'introduction' in lower or 'intro' in lower:
        return 'theory'
    if 'project setup' in lower or 'setup' in lower:
        return 'setup'
    if 'demo' in lower:
        return 'demo'
    if 'faq' in lower:
        return 'faq'
    return ''


def build_section_context(section_title: str, all_lessons: list, current_num: int) -> str:
    """Build a context block showing where this lesson sits in the section flow."""
    lines = [f"Section: {section_title}", "Lesson sequence in this section:"]
    for lesson in all_lessons:
        marker = "  ► " if lesson['num'] == current_num else "    "
        lines.append(f"{marker}{lesson['num']}. {lesson['title']}")
    return "\n".join(lines)


def _sanitize_llm_json(text: str) -> str:
    """Clean up LLM-generated JSON text so it can be parsed by json.loads().

    Handles:
    - Markdown code fences around JSON
    - Literal newlines / tabs inside JSON string values
    - Invalid backslash escapes (e.g. \\S, \\p) that are not legal JSON
    """
    text = text.strip()

    # Strip markdown fences
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

    # Fix control characters and invalid escapes inside JSON string literals
    def _fix_json_string(m):
        s = m.group(0)
        inner = s[1:-1]
        # Replace literal control characters
        inner = inner.replace('\r\n', '\\n')
        inner = inner.replace('\r', '\\n')
        inner = inner.replace('\n', '\\n')
        inner = inner.replace('\t', '\\t')
        # Fix invalid backslash escapes: keep valid ones, double-escape the rest.
        # Valid JSON escapes: \\ \" \/ \b \f \n \r \t \uXXXX
        inner = re.sub(
            r'\\(?!["\\/bfnrtu])',
            r'\\\\',
            inner,
        )
        return s[0] + inner + s[-1]

    text = re.sub(
        r'"(?:[^"\\]|\\.)*"',
        _fix_json_string,
        text,
        flags=re.DOTALL,
    )

    return text


def call_api(client: OpenAI, transcript: str, lesson_id: str, title: str, duration: int,
             section_context: str = "", model_override: str = None) -> dict:
    """Call the API (NVIDIA, Gemini, or Ollama via OpenAI wrapper) to generate lesson content."""
    model_to_use = model_override or MODEL
    user_prompt = f"""{section_context}

Lesson ID: {lesson_id}
Current Lesson Title: {title}
Video Duration: {duration} min

Transcript:
{transcript}"""

    kind_hint = classify_kind(title)
    if kind_hint:
        user_prompt += f"\n\nHint: This lesson is likely of kind '{kind_hint}'."

    for attempt in range(MAX_RETRIES):
        try:
            response_text = ""
            completion = client.chat.completions.create(
                model=model_to_use,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
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

            # Sanitize and parse JSON response
            response_text = _sanitize_llm_json(response_text)

            result = json.loads(response_text)
            return result

        except json.JSONDecodeError as e:
            print(f"    [WARN] JSON parse error on attempt {attempt + 1}: {e}")
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY * (2 ** attempt) + random.uniform(0, 2)
                print(f"    Retrying in {delay:.0f}s...")
                time.sleep(delay)
            else:
                print(f"    [ERROR] Failed to parse after {MAX_RETRIES} attempts. Using fallback.")
                return {
                    "title": title,
                    "duration": f"{duration} min",
                    "kind": kind_hint or "concept",
                    "summary": ["[Content generation failed - raw transcript available in source folder]"],
                    "keyPoints": [],
                }
        except Exception as e:
            is_rate_limit = "429" in str(e)
            label = "Rate limited" if is_rate_limit else "API error"
            print(f"    [WARN] {label} on attempt {attempt + 1}: {e}")
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY * (2 ** attempt) + random.uniform(0, 3)
                if is_rate_limit:
                    delay = max(delay, 20)
                print(f"    Retrying in {delay:.0f}s...")
                time.sleep(delay)
            else:
                print(f"    [ERROR] Failed after {MAX_RETRIES} attempts. Using fallback.")
                return {
                    "title": title,
                    "duration": f"{duration} min",
                    "kind": kind_hint or "concept",
                    "summary": ["[Content generation failed - raw transcript available in source folder]"],
                    "keyPoints": [],
                }


def escape_js_string(s: str) -> str:
    """Escape a string for use inside JavaScript single quotes."""
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def format_js_array(items: list, indent: int = 6) -> str:
    """Format a list of strings as a JS array with proper indentation."""
    if not items:
        return "[]"
    pad = " " * indent
    lines = []
    for item in items:
        escaped = escape_js_string(item)
        lines.append(f"{pad}'{escaped}',")
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

        # summary
        summary = lesson.get('summary', [])
        parts.append(f"    summary: {format_js_array(summary, 6)},")

        # keyPoints
        key_points = lesson.get('keyPoints', [])
        if key_points:
            parts.append(f"    keyPoints: {format_js_array(key_points, 6)},")

        # code
        if lesson.get('code'):
            code_val = lesson['code']
            # Ollama models may return code as a dict/list instead of a string — coerce it
            if not isinstance(code_val, str):
                code_val = json.dumps(code_val, indent=2) if isinstance(code_val, (dict, list)) else str(code_val)
            code_escaped = code_val.replace('`', '\\`').replace('${', '\\${')
            parts.append(f"    code: `{code_escaped}`,")
            if lesson.get('codeLabel'):
                parts.append(f"    codeLabel: '{escape_js_string(lesson['codeLabel'])}',")

        # note
        if lesson.get('note'):
            note = lesson['note']
            note_label = escape_js_string(note.get('label', 'NOTE'))
            note_text = escape_js_string(note.get('text', ''))
            note_tone = note.get('tone', 'accent')
            parts.append(f"    note: {{")
            parts.append(f"      label: '{note_label}',")
            parts.append(f"      text: '{note_text}',")
            parts.append(f"      tone: '{note_tone}',")
            parts.append(f"    }},")

        # quiz
        if lesson.get('quiz'):
            quiz = lesson['quiz']
            q_text = escape_js_string(quiz.get('question', ''))
            q_explanation = escape_js_string(quiz.get('explanation', ''))
            parts.append(f"    quiz: {{")
            parts.append(f"      question: '{q_text}',")
            parts.append(f"      options: [")
            for opt in quiz.get('options', []):
                opt_label = escape_js_string(opt.get('label', ''))
                opt_correct = 'true' if opt.get('correct') else 'false'
                parts.append(f"        {{ label: '{opt_label}', correct: {opt_correct} }},")
            parts.append(f"      ],")
            parts.append(f"      explanation: '{q_explanation}',")
            parts.append(f"    }},")

        entry = "  {\n" + "\n".join(parts) + "\n  }"
        entries.append(entry)

    return "export default [\n" + ",\n".join(entries) + ",\n]\n"


def generate_sections_js(sections_meta: list) -> str:
    """Generate the sections metadata JS file."""
    lines = [
        "// Section metadata — auto-generated from transcripts",
        "export const sectionMeta = [",
    ]
    for sec in sections_meta:
        color = sec.get('color') or COLOR_PALETTE[(sec['id'] - 1) % len(COLOR_PALETTE)]
        optional = 'true' if sec.get('optional', False) else 'false'
        title_escaped = escape_js_string(sec['title'])
        lines.append(f"  {{ id: {sec['id']},  title: '{title_escaped}', optional: {optional}, color: '{color}' }},")
    lines.append("]")
    return "\n".join(lines) + "\n"


def generate_glossary_js(glossary_terms: list) -> str:
    """Generate the glossary JS file."""
    lines = [
        "// Glossary — auto-generated from transcripts",
        "export const glossary = [",
    ]
    for term in glossary_terms:
        t = escape_js_string(term['term'])
        d = escape_js_string(term['def'])
        lines.append(f"  {{ term: '{t}', def: '{d}' }},")
    lines.append("]")
    return "\n".join(lines) + "\n"


def _load_lessons_from_existing_js(lessons_dir: Path, exclude_sections: set) -> dict:
    """Read already-written sectionXX.js files and extract lesson text for glossary generation.
    Only loads sections not in exclude_sections (those were just generated in this run)."""
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
            ids = re.findall(r"id:\s*'(\d+\.\d+)'", raw)
            titles_raw = re.findall(r"title:\s*'((?:[^'\\]|\\.)*)'", raw)
            titles = [t.replace("\\'", "'") for t in titles_raw]
            # Long strings (>40 chars) are summaries/keyPoints — skip short labels/ids
            long_strings = re.findall(r"'((?:[^'\\]|\\.){40,})'", raw)
            lessons_out = []
            per_lesson = max(1, len(long_strings) // max(len(ids), 1))
            for i, lid in enumerate(ids):
                chunk = long_strings[i * per_lesson: (i + 1) * per_lesson]
                lessons_out.append({
                    "id": lid,
                    "title": titles[i] if i < len(titles) else lid,
                    "summary": [s.replace("\\n", " ").replace("\\'", "'") for s in chunk],
                    "keyPoints": [],
                })
            if lessons_out:
                extra[sec_n] = lessons_out
        except Exception as e:
            print(f"  [WARN] Could not load existing section {sec_n} for glossary: {e}")
    return extra


def _parse_existing_sections_meta(sections_file: Path) -> list:
    """Parse an existing {slug}-sections.js file to extract section metadata entries."""
    content = sections_file.read_text(encoding='utf-8')
    entries = []
    # Match lines like: { id: 2,  title: 'Some Title', optional: false, color: '#3FB68B' },
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


GLOSSARY_PROMPT = """You are extracting a glossary of technical terms from a programming course.

Given the lesson summaries and key points below, produce a JSON array of glossary entries.
Each entry has:
- "term": The term or concept name (capitalize properly)
- "def": A concise 1-2 sentence definition suitable for a quick-reference glossary

Rules:
- Extract 20-40 of the most important, course-specific terms (APIs, classes, annotations, protocols, patterns, tools).
- Do NOT include generic programming terms (e.g., "variable", "loop", "class") unless they have a domain-specific meaning in this context.
- Sort alphabetically by term.
- Deduplicate — if a term appears in multiple lessons, write one unified definition.
- Definitions should be self-contained (understandable without reading the lesson).

Return ONLY a valid JSON array. No markdown fences, no extra text."""


def _generate_glossary_from_lessons(client: OpenAI, all_generated_lessons: dict, course_title: str, model: str = None) -> list:
    """Call the LLM to extract glossary terms from all generated lesson content."""
    # Collect summaries and key points as context
    context_parts = [f"Course: {course_title}\n"]
    for sec_num in sorted(all_generated_lessons.keys()):
        for lesson in all_generated_lessons[sec_num]:
            title = lesson.get('title', '')
            summary = ' '.join(lesson.get('summary', []))
            key_points = ' | '.join(lesson.get('keyPoints', []))
            if summary.startswith('[Content generation failed') and not key_points:
                continue
            context_parts.append(f"[{lesson.get('id', '')}] {title}: {summary} Key points: {key_points}")

    combined_context = "\n".join(context_parts)
    # Truncate to avoid token limits (keep ~60k chars)
    if len(combined_context) > 60000:
        combined_context = combined_context[:60000] + "\n... (truncated)"

    _rate_limiter.wait()
    try:
        response_text = ""
        completion = client.chat.completions.create(
            model=model or MODEL,
            messages=[
                {"role": "system", "content": GLOSSARY_PROMPT},
                {"role": "user", "content": combined_context},
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
        # Handle both {"glossary": [...]} and bare [...] responses
        if isinstance(result, dict):
            terms = result.get("glossary") or result.get("terms") or next(iter(result.values()), [])
        else:
            terms = result

        if isinstance(terms, list) and len(terms) > 0:
            # Validate entries have term + def
            valid = [t for t in terms if isinstance(t, dict) and 'term' in t and 'def' in t]
            if valid:
                return sorted(valid, key=lambda t: t['term'].lower())

    except Exception as e:
        print(f"  [WARN] Glossary generation failed: {e}")

    # Fallback: return minimal static glossary
    print("  [INFO] Using fallback glossary")
    return [
        {"term": "Flux", "def": "A Reactor Publisher that emits zero to N items."},
        {"term": "Mono", "def": "A Reactor Publisher that emits at most one item."},
        {"term": "R2DBC", "def": "Reactive Relational Database Connectivity — non-blocking database access."},
        {"term": "Reactive Streams", "def": "A specification for asynchronous stream processing with non-blocking backpressure."},
        {"term": "WebClient", "def": "Spring's non-blocking, reactive HTTP client replacing RestTemplate."},
        {"term": "WebFlux", "def": "Spring's reactive web framework built on Project Reactor."},
    ]


def generate_registry_snippet(slug: str, title: str, section_count: int) -> str:
    """Generate the code snippet to add to courseRegistry.js."""
    imports = []
    imports.append(f"import {{ sectionMeta as {slug}Sections }} from './{slug}-sections'")
    imports.append(f"import {{ glossary as {slug}Glossary }} from './{slug}-glossary'")
    for i in range(1, section_count + 1):
        imports.append(f"import {slug}_{i:02d} from './{slug}-lessons/section{i:02d}'")

    lesson_map = ", ".join([f"{i}: {slug}_{i:02d}" for i in range(1, section_count + 1)])

    registry_entry = f"""{{
    slug: '{slug}',
    title: '{escape_js_string(title)}',
    subtitle: 'Study Guide',
    description: 'Auto-generated study content from course transcripts.',
    color: '#5B8DEF',
    tags: ['Java', 'Spring', 'WebFlux'],
    sectionMeta: {slug}Sections,
    lessonsBySection: {{ {lesson_map} }},
    glossary: {slug}Glossary,
  }}"""

    return "\n".join(imports) + "\n\n" + f"const {slug}LessonsBySection = {{ {lesson_map} }}\n\n" + \
           f"// Add this to the courseDefs array:\n{registry_entry}"


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate site lesson data from transcript files using NVIDIA API"
    )
    parser.add_argument("transcript_folder", help="Path to folder containing transcript .txt files")
    parser.add_argument("--course-slug", default="webflux", help="URL-safe course identifier (default: webflux)")
    parser.add_argument("--course-title", default=None, help="Course title (auto-detected from CONTENTS.txt if not given)")
    parser.add_argument("--output-dir", default=None, help="Output directory (default: src/data/ relative to project root)")
    parser.add_argument("--sections", default=None, help="Comma-separated section numbers to process (e.g., '2,3,4'). Default: all")
    parser.add_argument("--workers", type=int, default=3, help="Number of parallel API calls (default: 3)")
    parser.add_argument("--dry-run", action="store_true", help="Parse and show plan without calling the API")
    parser.add_argument("--ollama", action="store_true", help="Use local Ollama server instead of NVIDIA/OpenAI API")
    parser.add_argument("--force", action="store_true", help="Regenerate sections even if output files already exist")
    parser.add_argument("--glossary-only", action="store_true", help="Skip lesson generation; regenerate glossary from all existing section files")

    args = parser.parse_args()

    # Validate API key (not needed for ollama)
    api_key = os.environ.get("API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("NVIDIA_API_KEY")
    if not api_key and not args.dry_run and not args.ollama:
        print("ERROR: No API key found. Set API_KEY, GEMINI_API_KEY, or NVIDIA_API_KEY in .env")
        sys.exit(1)

    transcript_folder = Path(args.transcript_folder)
    if not transcript_folder.is_dir():
        print(f"ERROR: Transcript folder not found: {transcript_folder}")
        sys.exit(1)

    # Determine output directory
    project_root = Path(__file__).resolve().parent.parent
    output_dir = Path(args.output_dir) if args.output_dir else project_root / "src" / "data"

    # Parse CONTENTS.txt if available
    contents_file = transcript_folder / "CONTENTS.txt"
    if contents_file.exists():
        print(f"[INFO] Parsing CONTENTS.txt...")
        sections_info = parse_contents_file(contents_file)
    else:
        print(f"[INFO] No CONTENTS.txt found — scanning .txt files directly...")
        # Build sections from filenames
        sections_info = {}
        for f in sorted(transcript_folder.iterdir()):
            if f.suffix != '.txt' or f.name == 'CONTENTS.txt':
                continue
            match = re.match(r'^(\d+)\.(\d+)\s+(.+)\.txt$', f.name)
            if match:
                sec_num = int(match.group(1))
                lesson_num = int(match.group(2))
                title = match.group(3).strip()
                if sec_num not in sections_info:
                    sections_info[sec_num] = {"title": f"Section {sec_num}", "lessons": []}
                sections_info[sec_num]["lessons"].append({
                    "num": lesson_num,
                    "title": title,
                    "duration": 5,  # default estimate
                })

    # Filter sections if requested
    if args.sections:
        selected = set(int(x.strip()) for x in args.sections.split(","))
        sections_info = {k: v for k, v in sections_info.items() if k in selected}

    if not sections_info:
        print("ERROR: No sections found to process.")
        sys.exit(1)

    # Course title
    course_title = args.course_title or "Spring WebFlux Course"

    slug = args.course_slug
    use_ollama = args.ollama
    active_model = OLLAMA_MODEL if use_ollama else MODEL
    backend_label = "Ollama (local)" if use_ollama else f"API ({BASE_URL})"

    lessons_dir = output_dir / f"{slug}-lessons"

    print(f"\n{'=' * 60}")
    print(f"  Transcript → Lesson Generator")
    print(f"{'=' * 60}")
    print(f"  Course slug:   {slug}")
    print(f"  Course title:  {course_title}")
    print(f"  Backend:       {backend_label}")
    print(f"  Model:         {active_model}")
    print(f"  Input folder:  {transcript_folder}")
    print(f"  Output dir:    {output_dir}")
    print(f"  Sections:      {sorted(sections_info.keys())}")
    total_lessons = sum(len(s['lessons']) for s in sections_info.values())
    print(f"  Total lessons: {total_lessons}")
    print(f"  Workers:       {args.workers}")
    print(f"{'=' * 60}\n")

    if args.dry_run:
        print("[DRY RUN] Would process the following:")
        for sec_num in sorted(sections_info.keys()):
            sec = sections_info[sec_num]
            print(f"\n  Section {sec_num}: {sec['title']}")
            for lesson in sec['lessons']:
                fname = find_transcript_file(transcript_folder, sec_num, lesson['num'], lesson['title'])
                status = "✓" if fname else "✗ (file not found)"
                print(f"    {sec_num}.{lesson['num']} {lesson['title']} [{lesson['duration']} min] {status}")
        print("\n[DRY RUN] No API calls made. Remove --dry-run to generate content.")
        return

    # Initialize API client and rate limiter
    global _rate_limiter
    _rate_limiter = RateLimiter(RPM_LIMIT)
    if use_ollama:
        # Ollama exposes an OpenAI-compatible API at /v1
        client = OpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")
        print(f"[INFO] Using Ollama backend at {OLLAMA_HOST} with model: {OLLAMA_MODEL}")
    else:
        client = OpenAI(base_url=BASE_URL, api_key=api_key)
    print(f"[INFO] Rate limiter: {RPM_LIMIT} requests/min")

    # Create output directories
    lessons_dir.mkdir(parents=True, exist_ok=True)

    # ─── Glossary-only mode ────────────────────────────────────────────────
    if args.glossary_only:
        all_sections = _load_lessons_from_existing_js(lessons_dir, exclude_sections=set())
        if not all_sections:
            print("[ERROR] No existing section files found in", lessons_dir)
            sys.exit(1)
        print(f"[INFO] Generating glossary from {len(all_sections)} existing section(s)...")
        active_model_name = OLLAMA_MODEL if use_ollama else MODEL
        glossary_terms = _generate_glossary_from_lessons(client, all_sections, course_title, model=active_model_name)
        glossary_js = generate_glossary_js(glossary_terms)
        glossary_file = output_dir / f"{slug}-glossary.js"
        glossary_file.write_text(glossary_js, encoding='utf-8')
        print(f"✓ Written: {glossary_file} ({len(glossary_terms)} terms)")
        return

    all_generated_lessons = {}  # {section_num: [lesson_objects]}

    # ─── Worker function for parallel processing ───────────────────────────
    def process_lesson(lesson_info, sec_num, section_context):
        """Process a single lesson — called from thread pool."""
        lesson_id = f"{sec_num}.{lesson_info['num']}"
        title = lesson_info['title']
        duration = lesson_info['duration']

        # Find and read transcript file
        transcript_file = find_transcript_file(transcript_folder, sec_num, lesson_info['num'], title)
        if not transcript_file:
            print(f"    [{lesson_id}] SKIP — file not found")
            return {
                "id": lesson_id,
                "title": title,
                "duration": f"{duration} min",
                "kind": classify_kind(title) or "concept",
                "summary": ["[Transcript file not found — content pending]"],
                "keyPoints": [],
            }

        transcript_text = transcript_file.read_text(encoding='utf-8')
        if len(transcript_text.strip()) < 50:
            print(f"    [{lesson_id}] SKIP — transcript too short")
            return {
                "id": lesson_id,
                "title": title,
                "duration": f"{duration} min",
                "kind": classify_kind(title) or "concept",
                "summary": ["[Transcript too short to generate meaningful content]"],
                "keyPoints": [],
            }

        # Call API with section context for continuity
        print(f"    [{lesson_id}] Generating...", flush=True)
        _rate_limiter.wait()
        active_model_name = OLLAMA_MODEL if use_ollama else MODEL
        result = call_api(client, transcript_text, lesson_id, title, duration, section_context,
                          model_override=active_model_name if use_ollama else None)
        print(f"    [{lesson_id}] ✓ Done", flush=True)

        # Merge with metadata — normalize summary/keyPoints to list of strings
        raw_summary = result.get("summary", [])
        if isinstance(raw_summary, str):
            raw_summary = [raw_summary]
        elif not isinstance(raw_summary, list):
            raw_summary = [str(raw_summary)]

        raw_key_points = result.get("keyPoints", [])
        if isinstance(raw_key_points, str):
            raw_key_points = [raw_key_points]
        elif not isinstance(raw_key_points, list):
            raw_key_points = [str(raw_key_points)]

        lesson_obj = {
            "id": lesson_id,
            "title": result.get("title", title),
            "duration": result.get("duration", f"{duration} min"),
            "kind": result.get("kind", classify_kind(title) or "concept"),
            "summary": raw_summary,
            "keyPoints": raw_key_points,
        }
        if result.get("code"):
            lesson_obj["code"] = result["code"]
        if result.get("codeLabel"):
            lesson_obj["codeLabel"] = result["codeLabel"]
        if result.get("note"):
            lesson_obj["note"] = result["note"]
        if result.get("quiz"):
            lesson_obj["quiz"] = result["quiz"]

        return lesson_obj

    # Process sections one at a time, lessons in parallel within each section
    completed_sections = 0
    failed_section = None
    for sec_num in sorted(sections_info.keys()):
        sec = sections_info[sec_num]

        # ─── Resume support: skip sections that already have output files ───
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

        # Build section context once — shared by all lessons in this section
        section_context = build_section_context(sec['title'], sec['lessons'], current_num=-1)

        # Submit all lessons in this section to the thread pool
        results_map = {}  # {lesson_num: lesson_obj}
        section_aborted = False
        try:
            with ThreadPoolExecutor(max_workers=args.workers) as executor:
                future_to_lesson = {}
                for lesson_info in sec['lessons']:
                    # Each lesson gets context with itself marked as current (►)
                    ctx = build_section_context(sec['title'], sec['lessons'], lesson_info['num'])
                    future = executor.submit(process_lesson, lesson_info, sec_num, ctx)
                    future_to_lesson[future] = lesson_info

                for future in as_completed(future_to_lesson):
                    lesson_info = future_to_lesson[future]
                    try:
                        lesson_obj = future.result()
                        results_map[lesson_info['num']] = lesson_obj
                    except Exception as e:
                        lesson_id = f"{sec_num}.{lesson_info['num']}"
                        print(f"    [{lesson_id}] ERROR: {e}")
                        results_map[lesson_info['num']] = {
                            "id": lesson_id,
                            "title": lesson_info['title'],
                            "duration": f"{lesson_info['duration']} min",
                            "kind": classify_kind(lesson_info['title']) or "concept",
                            "summary": [f"[Generation failed: {e}]"],
                            "keyPoints": [],
                        }
        except (KeyboardInterrupt, Exception) as e:
            print(f"\n  [ABORT] Section {sec_num} interrupted: {e}")
            print(f"  [INFO] Previously completed sections are preserved.")
            failed_section = sec_num
            section_aborted = True

        if section_aborted:
            break

        # Reassemble in correct order
        section_lessons = [results_map[li['num']] for li in sec['lessons'] if li['num'] in results_map]

        all_generated_lessons[sec_num] = section_lessons

        # Write section file immediately so progress is never lost
        section_js = generate_section_js(section_lessons)
        section_file.write_text(section_js, encoding='utf-8')
        completed_sections += 1
        print(f"\n  ✓ Written: {section_file}")

    # ─── Post-processing (always runs, even after partial completion) ──────

    # Generate sections metadata file (merge with existing when running partial sections)
    sections_meta = []
    for sec_num in sorted(sections_info.keys()):
        sections_meta.append({
            "id": sec_num,
            "title": sections_info[sec_num]["title"],
            "optional": False,
        })

    sections_file = output_dir / f"{slug}-sections.js"

    # Always merge with existing to preserve earlier runs
    if sections_file.exists():
        existing_meta = _parse_existing_sections_meta(sections_file)
        merged = {m['id']: m for m in existing_meta}
        for m in sections_meta:
            merged[m['id']] = m
        sections_meta = [merged[k] for k in sorted(merged.keys())]

    sections_js = generate_sections_js(sections_meta)
    sections_file.write_text(sections_js, encoding='utf-8')
    print(f"\n✓ Written: {sections_file}")

    # Generate glossary from lesson content via LLM (skip if no new lessons were generated)
    if all_generated_lessons:
        # Merge with content from already-existing sections not processed in this run,
        # so the glossary always covers the full course regardless of which sections were requested.
        existing_lessons = _load_lessons_from_existing_js(lessons_dir, set(all_generated_lessons.keys()))
        all_content_for_glossary = {**existing_lessons, **all_generated_lessons}
        section_count = len(all_content_for_glossary)
        print(f"\n[INFO] Generating glossary from {section_count} section(s) ({len(existing_lessons)} existing + {len(all_generated_lessons)} new)...")
        active_model_name = OLLAMA_MODEL if use_ollama else MODEL
        glossary_terms = _generate_glossary_from_lessons(client, all_content_for_glossary, course_title, model=active_model_name)
        glossary_js = generate_glossary_js(glossary_terms)
        glossary_file = output_dir / f"{slug}-glossary.js"
        glossary_file.write_text(glossary_js, encoding='utf-8')
        print(f"✓ Written: {glossary_file} ({len(glossary_terms)} terms)")
    else:
        print(f"\n[INFO] No new lessons generated — skipping glossary update.")

    # Print registry snippet (count all section files on disk, not just this run)
    total_sections_on_disk = len(list(lessons_dir.glob("section*.js")))
    print(f"\n{'=' * 60}")
    print(f"  REGISTRATION SNIPPET (for reference — runs automatically unless -SkipRegister)")
    print(f"{'=' * 60}\n")
    print(generate_registry_snippet(slug, course_title, total_sections_on_disk))

    # Summary
    print(f"\n{'=' * 60}")
    if failed_section:
        remaining = [s for s in sorted(sections_info.keys()) if s >= failed_section]
        print(f"  PARTIAL COMPLETION: {completed_sections}/{len(sections_info)} sections done.")
        print(f"  Remaining: {remaining}")
        print(f"  Re-run the same command to resume (completed sections are skipped).")
    else:
        print(f"  DONE! Generated {total_lessons} lessons across {len(sections_info)} sections.")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
