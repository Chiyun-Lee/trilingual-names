from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
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

def _row_vote_cells(row: dict) -> list[tuple[str, str | None, int | None]]:
    dp = row.get("decomposed_pinyin", {})
    return [
        ("definition",      row.get("definition"),      None),
        ("pinyin",          row.get("pinyin"),          None),
        ("toneless_pinyin", row.get("toneless_pinyin"), None),
        ("hangul",          row.get("hangul"),          None),
        ("anglo_hangul",    row.get("anglo_hangul"),    None),
        ("katakana",        row.get("katakana"),        None),
        ("anglo_katakana",  row.get("anglo_katakana"),  None),
        ("decomposed_pinyin", dp.get("initial"),        0),
        ("decomposed_pinyin", dp.get("final"),          1),
        ("decomposed_pinyin", str(dp["tone"]) if dp.get("tone") is not None else None, 2),
    ]


@app.get("/api/data")
def get_data(page: int = 0, page_size: int = 100, filter: str = "all") -> dict:
    all_rows = load_rows()

    if filter != "all":
        votes = db.get_votes()
        upvoted = {f"{v['column_name']}::{v['value']}::{v['sub_index']}" for v in votes if v["vote"] == 1}
        downvoted = {f"{v['column_name']}::{v['value']}::{v['sub_index']}" for v in votes if v["vote"] == -1}

        def _key(col, val, idx):
            return f"{col}::{val}::{idx}"

        def _is_upvoted(row):
            return any(_key(c, v, i) in upvoted for c, v, i in _row_vote_cells(row) if v)

        def _is_downvoted(row):
            return any(_key(c, v, i) in downvoted for c, v, i in _row_vote_cells(row) if v)

        if filter == "upvoted":
            rows = [r for r in all_rows if _is_upvoted(r)]
        elif filter == "non-downvoted":
            rows = [r for r in all_rows if not _is_downvoted(r)]
        else:
            rows = all_rows
    else:
        rows = all_rows

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


@app.get("/api/votes/export")
def export_votes() -> Response:
    votes = db.get_votes()
    payload = json.dumps({"votes": votes}, indent=2)
    filename = f"votes_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/votes/import")
async def import_votes(file: UploadFile) -> dict:
    try:
        raw = await file.read()
        payload = json.loads(raw)
        votes = payload["votes"]
    except Exception as e:
        raise HTTPException(400, f"Invalid file: {e}")

    imported = 0
    for v in votes:
        try:
            db.upsert_vote(v["column_name"], v["value"], v.get("sub_index"), v["vote"])
            imported += 1
        except Exception:
            pass
    return {"imported": imported}


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
