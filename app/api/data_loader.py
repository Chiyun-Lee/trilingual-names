import ast
import lzma
import os
import pickle
from functools import lru_cache
from pathlib import Path

_DEFAULT_DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "cleaned" / "merged.pkl.xz"
DATA_PATH = Path(os.environ.get("DATA_PATH", str(_DEFAULT_DATA_PATH)))

COLUMNS = [
    "hanzi", "definition", "pinyin", "decomposed_pinyin",
    "toneless_pinyin", "hangul", "anglo_hangul", "katakana", "anglo_katakana",
]

VOTEABLE_COLUMNS = [c for c in COLUMNS if c != "hanzi"]


def _parse_decomposed(raw: str) -> tuple[str, str, int] | None:
    """Parse string repr of tuple, e.g. \"('y', 'i', 1)\" → ('y', 'i', 1)."""
    try:
        result = ast.literal_eval(raw)
        if isinstance(result, tuple) and len(result) == 3:
            return (str(result[0]), str(result[1]), int(result[2]))
    except Exception:
        pass
    return None


@lru_cache(maxsize=1)
def load_rows() -> list[dict]:
    with lzma.open(DATA_PATH, "rb") as f:
        df = pickle.load(f)

    rows = []
    for i, row in enumerate(df.itertuples(index=False)):
        decomposed_raw = getattr(row, "decomposed_pinyin", "") or ""
        decomposed = _parse_decomposed(decomposed_raw)

        rows.append({
            "id": i,
            "hanzi":           str(row.hanzi) if row.hanzi == row.hanzi else None,
            "definition":      str(row.definition) if row.definition == row.definition else None,
            "pinyin":          str(row.pinyin) if row.pinyin == row.pinyin else None,
            "decomposed_pinyin": {
                "raw":    decomposed_raw,
                "initial": decomposed[0] if decomposed else None,
                "final":   decomposed[1] if decomposed else None,
                "tone":    decomposed[2] if decomposed else None,
            },
            "toneless_pinyin": str(row.toneless_pinyin) if row.toneless_pinyin == row.toneless_pinyin else None,
            "hangul":          str(row.hangul) if row.hangul == row.hangul else None,
            "anglo_hangul":    str(row.anglo_hangul) if row.anglo_hangul == row.anglo_hangul else None,
            "katakana":        str(row.katakana) if row.katakana == row.katakana else None,
            "anglo_katakana":  str(row.anglo_katakana) if row.anglo_katakana == row.anglo_katakana else None,
        })
    return rows
