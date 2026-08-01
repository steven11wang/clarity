"""Download College Panda SAT Reading articles as Markdown files.

Usage:
  python3 tools/download_college_panda.py [output-dir]

Default output directory: content/college-panda
"""

from __future__ import annotations

import html
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ARTICLES = [
    {
        "slug": "how-to-get-an-800-in-sat-reading",
        "url": "https://thecollegepanda.com/get-800-sat-reading/",
        "title": "How to Get an 800 in SAT Reading: How I Did It",
    },
    {
        "slug": "the-one-thing-that-will-improve-your-reading-score",
        "url": "https://thecollegepanda.com/the-one-thing-that-will-improve-your-reading-score-the-most/",
        "title": "The One Thing That Will Improve Your Reading Score the Most",
    },
    {
        "slug": "memorize-the-top-400-sat-words",
        "url": "https://thecollegepanda.com/memorize-the-top-400-sat-words-without-frustration/",
        "title": "Memorize the Top 400 SAT Words Without Frustration",
    },
    {
        "slug": "eliminate-dont-vindicate-nullify-dont-justify",
        "url": "https://thecollegepanda.com/eliminate-dont-vindicate-nullify-dont-justify/",
        "title": "Eliminate, Don't Vindicate; Nullify, Don't Justify",
    },
    {
        "slug": "sat-reading-strategies-purpose-questions",
        "url": "https://thecollegepanda.com/sat-reading-strategies-how-to-answer-purpose-questions/",
        "title": "SAT Reading Strategies: How to Answer Purpose Questions",
    },
    {
        "slug": "sat-reading-strategies-watch-out-for-pivots",
        "url": "https://thecollegepanda.com/sat-reading-strategies-watch-out-for-pivots/",
        "title": "SAT Reading Strategies: Watch Out For Pivots",
    },
]

BASE_URL = "https://thecollegepanda.com"


class EntryContentExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_entry_content = False
        self.depth = 0
        self.skip_depth = 0
        self.chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            if self.in_entry_content:
                self.skip_depth += 1
            return

        if tag == "div":
            attrs_dict = dict(attrs)
            if attrs_dict.get("class") == "entry-content":
                self.in_entry_content = True
                self.depth = 1
                return
        if not self.in_entry_content or self.skip_depth:
            return

        self.depth += 1
        attrs_dict = dict(attrs)

        if tag == "p":
            self.chunks.append("\n\n")
        elif tag == "h4":
            self.chunks.append("\n\n#### ")
        elif tag == "h3":
            self.chunks.append("\n\n### ")
        elif tag == "h2":
            self.chunks.append("\n\n## ")
        elif tag == "li":
            self.chunks.append("\n- ")
        elif tag == "br":
            self.chunks.append("\n")
        elif tag == "a":
            href = attrs_dict.get("href") or ""
            if href.startswith("/"):
                href = BASE_URL + href
            self.chunks.append("[")
            self._link_href = href
            self._in_link = True
        elif tag in {"strong", "b"}:
            self.chunks.append("**")
            self._bold_depth = getattr(self, "_bold_depth", 0) + 1
        elif tag in {"em", "i"}:
            self.chunks.append("*")
            self._em_depth = getattr(self, "_em_depth", 0) + 1
        elif tag == "img":
            alt = attrs_dict.get("alt") or "image"
            src = attrs_dict.get("src") or ""
            if src.startswith("/"):
                src = BASE_URL + src
            self.chunks.append(f"![{alt}]({src})")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            if self.skip_depth:
                self.skip_depth -= 1
            return

        if not self.in_entry_content or self.skip_depth:
            return

        if tag == "div" and self.depth == 1:
            self.in_entry_content = False
            return

        self.depth -= 1

        if tag in {"strong", "b"} and getattr(self, "_bold_depth", 0) > 0:
            self.chunks.append("**")
            self._bold_depth -= 1
        elif tag in {"em", "i"} and getattr(self, "_em_depth", 0) > 0:
            self.chunks.append("*")
            self._em_depth -= 1
        elif tag == "a" and getattr(self, "_in_link", False):
            href = getattr(self, "_link_href", "")
            self.chunks.append(f"]({href})")
            self._in_link = False

    def handle_data(self, data: str) -> None:
        if self.in_entry_content and not self.skip_depth:
            self.chunks.append(html.unescape(data))

    def get_markdown(self) -> str:
        text = "".join(self.chunks)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"^\t+", "", text, flags=re.MULTILINE)
        return text.strip()


def fetch_html(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; clarity-downloader/1.0)"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_title(page_html: str, fallback: str) -> str:
    match = re.search(r'<h1 class="entry-title">(.*?)</h1>', page_html, re.DOTALL)
    if not match:
        return fallback
    title = re.sub(r"<[^>]+>", "", match.group(1))
    return html.unescape(title.strip())


def html_to_markdown(page_html: str) -> str:
    parser = EntryContentExtractor()
    parser.feed(page_html)
    return parser.get_markdown()


def article_to_markdown(title: str, url: str, body: str) -> str:
    return "\n".join(
        [
            f"# {title}",
            "",
            f"Source: [{url}]({url})",
            "",
            body,
            "",
        ]
    )


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    output_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else repo_root / "content" / "college-panda"
    output_dir.mkdir(parents=True, exist_ok=True)

    for article in ARTICLES:
        print(f"Downloading: {article['title']}")
        page_html = fetch_html(article["url"])
        title = extract_title(page_html, article["title"])
        body = html_to_markdown(page_html)
        markdown = article_to_markdown(title, article["url"], body)
        out_path = output_dir / f"{article['slug']}.md"
        out_path.write_text(markdown, encoding="utf-8")
        print(f"  -> {out_path} ({len(markdown):,} bytes)")

    print(f"\nDone. Wrote {len(ARTICLES)} files to {output_dir}")


if __name__ == "__main__":
    main()
