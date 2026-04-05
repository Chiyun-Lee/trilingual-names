#!/usr/bin/env python3
"""
Scrape StarlingDB Chinese character databases and output TSV files.
Only entries with a non-empty Character field are included.

Databases:
  - /data/china/doc       (Chinese Dialects, 2614 records)
  - /data/china/bigchina  (Chinese Etymological, 9364 records)

Output:
  - data/starling_doc.tsv
  - data/starling_bigchina.tsv
"""

import re
import sys
import time

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://starlingdb.org/cgi-bin/response.cgi"

DATABASES = [
    {
        "name": "doc",
        "basename": "../data/china/doc",
        "output": "../data/starling_doc.tsv",
    },
    {
        "name": "bigchina",
        "basename": "../data/china/bigchina",
        "output": "../data/starling_bigchina.tsv",
    },
]

DELAY = 1.0  # seconds between requests (be polite)
HEADERS = {"User-Agent": "Mozilla/5.0 (research scraper; contact: academic use)"}


def fetch_page(basename: str, first: int) -> str:
    params = {"root": "config", "basename": basename, "first": first}
    for attempt in range(3):
        try:
            resp = requests.get(BASE_URL, params=params, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            wait = 5 * (attempt + 1)
            print(f"\n  Attempt {attempt + 1} failed ({e}), retrying in {wait}s...", file=sys.stderr)
            if attempt < 2:
                time.sleep(wait)
            else:
                raise


def get_total_records(html: str) -> int:
    soup = BeautifulSoup(html, "lxml")
    div = soup.find("div", class_="total")
    if div:
        m = re.search(r"(\d+)\s+records?", div.get_text())
        if m:
            return int(m.group(1))
    return 0


def parse_entries(html: str) -> list[dict]:
    """Parse a page and return list of field dicts, one per record."""
    soup = BeautifulSoup(html, "lxml")
    records = soup.find_all("div", class_="results_record")
    entries = []

    for record in records:
        entry = {}
        # Each field is a direct <div> child with <span class="fld"> and <span class="unicode">
        for field_div in record.find_all("div", recursive=False):
            fld_span = field_div.find("span", class_="fld")
            if not fld_span:
                continue

            # Extract field name, strip trailing colon/whitespace
            label = fld_span.get_text(strip=True).rstrip(":").strip()
            if not label:
                continue

            # Value: prefer <span class="unicode">, fall back to any link text
            unicode_span = field_div.find("span", class_="unicode")
            if unicode_span:
                value = unicode_span.get_text(separator=" ", strip=True)
            else:
                # Cross-reference link: store the href URL
                link = field_div.find("a", href=True)
                value = link["href"] if link else ""

            entry[label] = value

        if entry:
            entries.append(entry)

    return entries


def scrape(db: dict) -> None:
    name = db["name"]
    basename = db["basename"]
    output_path = db["output"]

    print(f"\nScraping '{name}' → {output_path}")

    # Get total from first page
    first_html = fetch_page(basename, 1)
    total = get_total_records(first_html)
    if total == 0:
        print("  ERROR: could not determine total records", file=sys.stderr)
        return
    pages = (total + 19) // 20
    print(f"  Total records: {total}  ({pages} pages)")

    all_entries: list[dict] = []
    seen_fields: dict[str, int] = {}  # preserves insertion order + counts

    def process_html(html: str) -> None:
        entries = parse_entries(html)
        for entry in entries:
            if not entry.get("Character", "").strip():
                continue
            all_entries.append(entry)
            for key in entry:
                seen_fields.setdefault(key, 0)
                seen_fields[key] += 1

    # Process page 1 (already fetched)
    process_html(first_html)

    # Remaining pages
    firsts = list(range(21, total + 1, 20))
    for i, first in enumerate(firsts, start=2):
        print(f"  Page {i}/{pages} (first={first})    ", end="\r", flush=True)
        try:
            html = fetch_page(basename, first)
        except Exception as e:
            print(f"\n  SKIP page first={first}: {e}", file=sys.stderr)
            time.sleep(DELAY)
            continue
        process_html(html)
        time.sleep(DELAY)

    print(f"\n  Entries with Character: {len(all_entries)}")

    if not all_entries:
        print("  WARNING: nothing to write.", file=sys.stderr)
        return

    # Build column order: Character first, then remaining in discovery order
    headers = ["Character"] + [k for k in seen_fields if k != "Character"]

    with open(output_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\t".join(headers) + "\n")
        for entry in all_entries:
            row = [
                entry.get(h, "").replace("\t", " ").replace("\n", " ").replace("\r", " ")
                for h in headers
            ]
            f.write("\t".join(row) + "\n")

    print(f"  Written {len(all_entries)} rows, {len(headers)} columns.")


def main() -> None:
    for db in DATABASES:
        scrape(db)
    print("\nDone.")


if __name__ == "__main__":
    main()
