from __future__ import annotations

from collections import defaultdict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
from data_loader import VOTEABLE_COLUMNS, load_rows

app = FastAPI(title="trilingual-names API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    db.init_db()
    load_rows()  # warm the cache


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

@app.get("/api/data")
def get_data(page: int = 0, page_size: int = 100) -> dict:
    rows = load_rows()
    total = len(rows)
    start = page * page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "rows": rows[start: start + page_size],
    }


# ---------------------------------------------------------------------------
# Votes
# ---------------------------------------------------------------------------

class VoteBody(BaseModel):
    column_name: str
    value: str
    sub_index: int | None = None
    vote: int  # 1 or -1


@app.get("/api/votes")
def get_votes() -> list[dict]:
    return db.get_votes()


@app.put("/api/votes")
def put_vote(body: VoteBody) -> dict:
    if body.column_name not in VOTEABLE_COLUMNS:
        raise HTTPException(400, f"column_name must be one of {VOTEABLE_COLUMNS}")
    if body.vote not in (1, -1):
        raise HTTPException(400, "vote must be 1 or -1")
    db.upsert_vote(body.column_name, body.value, body.sub_index, body.vote)
    return {"ok": True}


@app.delete("/api/votes")
def delete_vote(body: VoteBody) -> dict:
    db.delete_vote(body.column_name, body.value, body.sub_index)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Explore — parallel categories aggregation
# ---------------------------------------------------------------------------

EXPLORE_COLUMNS = [
    "pinyin", "toneless_pinyin", "hangul",
    "anglo_hangul", "katakana", "anglo_katakana",
]


def _cell_value(row: dict, col: str) -> str | None:
    """Return the scalar string value for a column in a row."""
    if col == "decomposed_pinyin":
        return row["decomposed_pinyin"]["raw"] or None
    return row.get(col)


@app.get("/api/explore")
def get_explore(source: str, target: str) -> dict:
    if source not in EXPLORE_COLUMNS or target not in EXPLORE_COLUMNS:
        raise HTTPException(400, f"source and target must be in {EXPLORE_COLUMNS}")
    if source == target:
        raise HTTPException(400, "source and target must differ")

    rows = load_rows()

    # {(src_val, tgt_val): [{"hanzi", "definition"}, ...]}
    links: dict[tuple[str, str], list[dict]] = defaultdict(list)

    for row in rows:
        s = _cell_value(row, source)
        t = _cell_value(row, target)
        if s and t:
            links[(s, t)].append({
                "hanzi":      row["hanzi"],
                "definition": row["definition"],
            })

    # Aggregate counts; include up to 5 sample hanzi per link
    result = []
    for (s, t), entries in links.items():
        result.append({
            "source": s,
            "target": t,
            "count":  len(entries),
            "samples": entries[:5],
        })

    # Sort by count descending so the frontend can render heaviest flows first
    result.sort(key=lambda x: x["count"], reverse=True)

    # Collect ordered unique node lists (by total flow weight)
    src_totals: dict[str, int] = defaultdict(int)
    tgt_totals: dict[str, int] = defaultdict(int)
    for link in result:
        src_totals[link["source"]] += link["count"]
        tgt_totals[link["target"]] += link["count"]

    source_nodes = sorted(src_totals, key=lambda k: src_totals[k], reverse=True)
    target_nodes = sorted(tgt_totals, key=lambda k: tgt_totals[k], reverse=True)

    return {
        "source_column": source,
        "target_column": target,
        "source_nodes":  source_nodes,
        "target_nodes":  target_nodes,
        "links":         result,
    }
