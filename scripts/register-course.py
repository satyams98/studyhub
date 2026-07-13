#!/usr/bin/env python3
"""
Register a generated course into courseRegistry.js automatically.

Usage:
    python scripts/register-course.py --slug webflux --title "Spring WebFlux" --sections 13

This modifies src/data/courseRegistry.js to add imports and the course definition.
"""

import argparse
import re
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Register a generated course into courseRegistry.js")
    parser.add_argument("--slug", required=True, help="Course slug (e.g., webflux)")
    parser.add_argument("--title", required=True, help="Course title")
    parser.add_argument("--subtitle", default="Study Guide", help="Course subtitle")
    parser.add_argument("--sections", required=True, type=int, help="Number of sections")
    parser.add_argument("--tags", default="Java,Spring,WebFlux", help="Comma-separated tags")
    parser.add_argument("--color", default="#5B8DEF", help="Primary accent color")

    args = parser.parse_args()
    slug = args.slug
    title = args.title
    section_count = args.sections
    tags = [t.strip() for t in args.tags.split(",")]

    project_root = Path(__file__).resolve().parent.parent
    registry_path = project_root / "src" / "data" / "courseRegistry.js"

    if not registry_path.exists():
        print(f"ERROR: courseRegistry.js not found at {registry_path}")
        return

    content = registry_path.read_text(encoding='utf-8')

    # Idempotency: if this slug is already registered, strip its old imports,
    # lessonsBySection map, and course def so we can re-insert cleanly.
    if f"slug: '{slug}'" in content:
        print(f"  [INFO] Course '{slug}' already registered — updating in place.")
        # Remove old imports for this slug
        content = re.sub(
            rf"^import .+from '\.\/{re.escape(slug)}(?:-sections|-glossary|-lessons/section\d+)'.*\n",
            '', content, flags=re.MULTILINE
        )
        # Remove old lessonsBySection map
        content = re.sub(
            rf"\nconst {re.escape(slug)}LessonsBySection\s*=\s*\{{[^}}]*\}}\n",
            '\n', content
        )
        # Remove old course def block from courseDefs array
        content = re.sub(
            rf"  \{{\n\s*slug: '{re.escape(slug)}',.*?\}},\n",
            '', content, flags=re.DOTALL
        )
        # Clean up multiple blank lines left behind
        content = re.sub(r'\n{3,}', '\n\n', content)

    # Build import lines
    import_lines = []
    import_lines.append(f"import {{ sectionMeta as {slug}Sections }} from './{slug}-sections'")
    import_lines.append(f"import {{ glossary as {slug}Glossary }} from './{slug}-glossary'")
    for i in range(1, section_count + 1):
        import_lines.append(f"import {slug}{i:02d} from './{slug}-lessons/section{i:02d}'")

    imports_block = "\n".join(import_lines)

    # Build lessons-by-section map
    map_entries = ", ".join([f"{i}: {slug}{i:02d}" for i in range(1, section_count + 1)])
    map_block = f"\nconst {slug}LessonsBySection = {{\n  {map_entries},\n}}\n"

    # Build course definition
    tags_str = ", ".join([f"'{t}'" for t in tags])
    course_def = f"""  {{
    slug: '{slug}',
    title: '{title}',
    subtitle: '{args.subtitle}',
    description: 'Study content generated from course transcripts.',
    color: '{args.color}',
    tags: [{tags_str}],
    sectionMeta: {slug}Sections,
    lessonsBySection: {slug}LessonsBySection,
    glossary: {slug}Glossary,
  }},"""

    # Insert imports after the last existing import line
    last_import_idx = 0
    for m in re.finditer(r'^import .+$', content, re.MULTILINE):
        last_import_idx = m.end()

    if last_import_idx > 0:
        content = content[:last_import_idx] + "\n\n" + imports_block + map_block + content[last_import_idx:]
    else:
        content = imports_block + map_block + "\n" + content

    # Insert course def before the closing of courseDefs array
    # Look for the comment "── Add more courses below" or the closing ]
    add_marker = re.search(r'// ── Add more courses below.*\n', content)
    if add_marker:
        insert_pos = add_marker.end()
        content = content[:insert_pos] + course_def + "\n" + content[insert_pos:]
    else:
        # Find the closing ] of courseDefs
        closing = content.rfind(']')
        if closing > 0:
            content = content[:closing] + course_def + "\n" + content[closing:]

    registry_path.write_text(content, encoding='utf-8')
    print(f"✓ Updated {registry_path}")
    print(f"  Added course '{slug}' with {section_count} sections.")


if __name__ == "__main__":
    main()
