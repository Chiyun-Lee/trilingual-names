"""
SQLite persistence for votes.

Vote schema
-----------
column_name : str   — e.g. "toneless_pinyin", "decomposed_pinyin"
value       : str   — the matched value, e.g. "yi" or "i" (sub-component)
sub_index   : int?  — NULL for full-cell votes;
                      0 = initial, 1 = final, 2 = tone for decomposed_pinyin
vote        : int   — 1 = upvote, -1 = downvote
"""

import os
import sqlite3
from pathlib import Path

_DEFAULT_DB_PATH = Path(__file__).resolve().parent / "votes.db"
DB_PATH = Path(os.environ.get("DB_PATH", str(_DEFAULT_DB_PATH)))


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                column_name  TEXT    NOT NULL,
                value        TEXT    NOT NULL,
                sub_index    INTEGER,
                vote         INTEGER NOT NULL CHECK (vote IN (1, -1)),
                PRIMARY KEY (column_name, value, sub_index)
            )
        """)


def get_votes() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM votes").fetchall()
    return [dict(r) for r in rows]


def upsert_vote(column_name: str, value: str, sub_index: int | None, vote: int) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO votes (column_name, value, sub_index, vote)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (column_name, value, sub_index)
            DO UPDATE SET vote = excluded.vote
            """,
            (column_name, value, sub_index, vote),
        )


def delete_vote(column_name: str, value: str, sub_index: int | None) -> None:
    with _connect() as conn:
        conn.execute(
            "DELETE FROM votes WHERE column_name = ? AND value = ? AND sub_index IS ?",
            (column_name, value, sub_index),
        )
