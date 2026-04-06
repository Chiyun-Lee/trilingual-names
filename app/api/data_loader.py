import ast
import lzma
import os
import pickle
from functools import lru_cache
from pathlib import Path

DATA_PATH = Path(os.environ.get(
    "DATA_PATH",
    Path(__file__).parent.parent.parent / "data" / "cleaned" / "merged.pkl.xz",
))

COLUMNS = [
    "hanzi", "simplified", "radical", "definition", "pinyin", "decomposed_pinyin",
    "toneless_pinyin", "hangul", "anglo_hangul", "katakana", "anglo_katakana",
    "meaning", "name_use", "note",
]

VOTEABLE_COLUMNS = [
    "radical", "definition", "pinyin", "decomposed_pinyin",
    "toneless_pinyin", "hangul", "anglo_hangul", "katakana", "anglo_katakana",
    "name_use", "note",
]


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

        def _str(val) -> str | None:
            return str(val) if val == val and val is not None else None

        rows.append({
            "id": i,
            "hanzi":           _str(row.hanzi),
            "simplified":      _str(getattr(row, "simplified", None)),
            "radical":         _str(getattr(row, "radical", None)),
            "definition":      _str(row.definition),
            "pinyin":          _str(row.pinyin),
            "decomposed_pinyin": {
                "raw":    decomposed_raw,
                "initial": decomposed[0] if decomposed else None,
                "final":   decomposed[1] if decomposed else None,
                "tone":    decomposed[2] if decomposed else None,
            },
            "toneless_pinyin": _str(row.toneless_pinyin),
            "hangul":          _str(row.hangul),
            "anglo_hangul":    _str(row.anglo_hangul),
            "katakana":        _str(row.katakana),
            "anglo_katakana":  _str(row.anglo_katakana),
            "meaning":         _str(getattr(row, "meaning", None)),
            "name_use":        _str(getattr(row, "name_use", None)),
            "note":            _str(getattr(row, "note", None)),
        })
    return rows
