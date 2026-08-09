#!/usr/bin/env python3
"""Convert Astronomy textbook LaTeX into blog-style HTML chapters."""

from __future__ import annotations

import html
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "tmp-astro" / "main.tex"
CLEAN = ROOT / "tmp-astro" / "main.clean.tex"
OUT_DIR = ROOT / "astronomy"
IMG_DIR = OUT_DIR / "images"


def preprocess(tex: str) -> str:
    # Drop lipsum placeholder chapters; keep real content.
    tex = re.sub(
        r"\\chapter\*\{Preface\}.*?\\mainmatter",
        r"\\mainmatter\n",
        tex,
        count=1,
        flags=re.S,
    )

    # Remove packages/commands pandoc struggles with.
    drop_pkgs = [
        r"\\usepackage\{titlesec\}",
        r"\\usepackage\{tocloft\}",
        r"\\usepackage\{lipsum\}.*",
        r"\\usepackage\{physics\}",
        r"\\usepackage\{siunitx\}",
        r"\\usepackage\{tikz\}",
        r"\\usepackage\[version=4\]\{mhchem\}",
        r"\\usepackage\{xcolor\}",
        r"\\usepackage\{color\}",
    ]
    for pat in drop_pkgs:
        tex = re.sub(pat + r"\n?", "", tex)

    tex = re.sub(r"\\definecolor\{.*?\}\n?", "", tex)
    tex = re.sub(
        r"\\newcommand\\greybox\[1\]\{%.*?%\n\}\n?",
        "",
        tex,
        flags=re.S,
    )
    tex = re.sub(r"% Chapter and section formatting.*?\\begin\{document\}", r"\\begin{document}", tex, flags=re.S)
    tex = re.sub(r"\\titleformat\{.*?\}\n?", "", tex)
    tex = re.sub(r"\\maketitle\n?", "", tex)
    tex = re.sub(r"\\frontmatter\n?", "", tex)
    tex = re.sub(r"\\tableofcontents\n?", "", tex)
    tex = re.sub(r"\\mainmatter\n?", "", tex)
    tex = re.sub(r"\\part\{.*?\}\n?", "", tex)
    tex = re.sub(r"\\addcontentsline\{toc\}\{chapter\}\{.*?\}\n?", "", tex)
    tex = re.sub(r"\\vspace\{.*?\}\n?", "\n", tex)
    tex = re.sub(r"\\hspace\{.*?\}\n?", "\n", tex)
    tex = re.sub(r"\\greybox\{", "{", tex)
    tex = re.sub(r"\\lipsum(\[[^\]]*\])?", "", tex)
    tex = re.sub(r"\\ce\{([^}]*)\}", r"\\mathrm{\1}", tex)

    # Normalize includegraphics options / broken line breaks / image paths.
    def fix_includegraphics(match: re.Match[str]) -> str:
        opts = match.group(1) or ""
        name = match.group(2)
        opts = re.sub(r"\s+", "", opts)
        opts = re.sub(r",?decodearray=\{[^}]*\}", "", opts)
        opts = re.sub(r",?length=[^,\]\[]+", "", opts)
        opts = opts.strip(",")
        path = f"images/{name}"
        if opts:
            return f"\\includegraphics[{opts}]{{{path}}}"
        return f"\\includegraphics{{{path}}}"

    tex = re.sub(
        r"\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}",
        fix_includegraphics,
        tex,
        flags=re.S,
    )

    # Soften a few common unsupported macros.
    tex = tex.replace(r"\textsuperscript{", r"^{")
    # Fix accidental ^{2} closing from above replacement for E=mc style in chem — leave as-is; pandoc handles ^ in math.

    return tex


def slugify(title: str) -> str:
    s = title.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "chapter"


NAV = """    <nav class="top-nav" aria-label="Primary">
        <a href="../projects.html">projects</a><span class="sep">&middot;</span><a href="../experience.html">experience</a>
    </nav>"""


PAGE_SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
    <title>{title} | Hugo Sanchez</title>
    <meta charset="UTF-8">
    <meta name="description" content="{description}">
    <meta name="author" content="Hugo Sanchez">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="../index.css">
    <link rel="stylesheet" href="astronomy.css">
    <script>
      MathJax = {{
        tex: {{ inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] }},
        svg: {{ fontCache: 'global' }}
      }};
    </script>
    <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
</head>
<body>
{nav}
    <div id="holder">
        <div id="left"></div>
        <div id="middle" class="blog-middle">
{body}
        </div>
        <div id="right"></div>
    </div>
</body>
</html>
"""


def wrap_page(title: str, description: str, body: str) -> str:
    return PAGE_SHELL.format(
        title=html.escape(title),
        description=html.escape(description),
        nav=NAV,
        body=body,
    )


def split_chapters(full_html: str) -> list[tuple[str, str]]:
    # Pandoc book chapters become <h1>.
    parts = re.split(r"<h1[^>]*>", full_html)
    chapters: list[tuple[str, str]] = []
    for part in parts[1:]:
        m = re.match(r"(.*?)</h1>(.*)", part, flags=re.S)
        if not m:
            continue
        title = re.sub(r"<[^>]+>", "", m.group(1))
        title = re.sub(r"\s+", " ", title).strip()
        body = m.group(2).strip()
        if not title:
            continue
        # Skip nearly empty leftovers.
        text_only = re.sub(r"<[^>]+>", "", body).strip()
        if len(text_only) < 40:
            continue
        chapters.append((title, body))
    return chapters


def rewrite_images(fragment: str) -> str:
    # Pandoc may emit src="images/..." already; keep relative.
    fragment = fragment.replace('src="images/', 'src="images/')
    fragment = re.sub(
        r'<img([^>]*?)style="[^"]*"',
        r"<img\1",
        fragment,
    )
    return fragment


def main() -> int:
    if not SRC.exists():
        print(f"Missing source: {SRC}", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    IMG_DIR.mkdir(parents=True, exist_ok=True)

    cleaned = preprocess(SRC.read_text(encoding="utf-8", errors="replace"))
    CLEAN.write_text(cleaned, encoding="utf-8")

    # Run pandoc from astronomy/ so image paths resolve.
    result = subprocess.run(
        [
            "pandoc",
            str(CLEAN),
            "-f",
            "latex",
            "-t",
            "html5",
            "--mathjax",
            "--standalone=false",
            "-o",
            "-",
        ],
        cwd=str(OUT_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        return result.returncode

    chapters = split_chapters(result.stdout)
    if not chapters:
        print("No chapters produced", file=sys.stderr)
        return 1

    # Index
    items = []
    chapter_files: list[tuple[str, str, str]] = []
    for i, (title, body) in enumerate(chapters, start=1):
        slug = f"{i:02d}-{slugify(title)}"
        filename = f"{slug}.html"
        chapter_files.append((title, filename, body))
        items.append(f'            <li><a href="{filename}">{html.escape(title)}</a></li>')

    index_body = f"""            <p class="back"><a href="../projects.html">&larr; Projects</a></p>
            <h1>Astronomy: General Theory</h1>
            <p class="lede">A stellar-evolution textbook draft, converted from LaTeX into a readable web version with figures and equations.</p>
            <h2>Chapters</h2>
            <ol class="chapter-list">
{chr(10).join(items)}
            </ol>"""
    (OUT_DIR / "index.html").write_text(
        wrap_page("Astronomy Textbook", "Astronomy textbook by Hugo Sanchez", index_body),
        encoding="utf-8",
    )

    for idx, (title, filename, body) in enumerate(chapter_files):
        body = rewrite_images(body)
        prev_link = ""
        next_link = ""
        if idx > 0:
            prev_title, prev_file, _ = chapter_files[idx - 1]
            prev_link = f'<a href="{prev_file}">&larr; {html.escape(prev_title)}</a>'
        if idx < len(chapter_files) - 1:
            next_title, next_file, _ = chapter_files[idx + 1]
            next_link = f'<a href="{next_file}">{html.escape(next_title)} &rarr;</a>'

        chapter_body = f"""            <p class="back"><a href="index.html">&larr; All chapters</a></p>
            <h1>{html.escape(title)}</h1>
            <article class="chapter">
{body}
            </article>
            <nav class="chapter-nav">
                <div>{prev_link}</div>
                <div>{next_link}</div>
            </nav>"""
        (OUT_DIR / filename).write_text(
            wrap_page(title, f"{title} — Astronomy textbook", chapter_body),
            encoding="utf-8",
        )

    print(f"Wrote {len(chapter_files)} chapters to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
