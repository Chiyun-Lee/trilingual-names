# trilingual-names

A tool for exploring and curating Chinese character data across Mandarin (pinyin), Korean (hangul), and Japanese (katakana) pronunciation systems.

| Curate | Explore |
|--------|---------|
| ![Curate page — search and vote on characters](data/assets/Screenshot%202026-04-06%20at%2020.04.54.png) | ![Explore page — parallel categories flow](data/assets/Screenshot%202026-04-06%20at%2020.05.19.png) |

## TODO

```
- 
```

## Data sources

- [Unicode Unihan Database](https://www.unicode.org/versions/Unicode17.0.0/)
- [StarlingDB — Chinese Dialects](https://starlingdb.org/cgi-bin/response.cgi?root=config&morpho=0&basename=\data\china\doc&first=1)
- [StarlingDB — Chinese Etymological](https://starlingdb.org/cgi-bin/response.cgi?root=config&morpho=0&basename=\data\china\bigchina&first=1)

## Project structure

```
data/
  raw/          ← source TSV/TXT files (committed)
  cleaned/      ← generated pickles (gitignored, produced by notebooks)

src/
  01_generate-data/   ← scrape_starling.py: fetches StarlingDB TSVs
  02_cleaning-data/   ← cleaning notebooks for Unihan and StarlingDB
  03_playing-with-data/ ← merge notebook; exports data/cleaned/merged.pkl.xz

app/
  api/          ← FastAPI backend (data + vote persistence via SQLite)
  frontend/     ← React + MUI + Vite app (Curate & Explore pages)
  docker-compose.yml
```

## Setup

### 1. Set up local LLM (Qwen) for annotations

The merge notebook annotates each character with English meaning, name-suitability, and cultural notes using [Qwen2.5:7b](https://ollama.com/library/qwen2.5) via [Ollama](https://ollama.com/).

```bash
# Install Ollama (macOS)
brew install ollama

# Start the server (runs in background on port 11434)
ollama serve &

# Pull the model (~4.7 GB, only needed once)
ollama pull qwen2.5:7b
```

Install the Python client into your venv:
```bash
pip install ollama
```

Annotations are cached in `data/cleaned/annotations.json` after every character, so the run is fully resumable. Re-running the annotation cell skips already-processed characters.

> **Minimum specs:** 8 GB RAM. On Apple Silicon the model runs on the Neural Engine; on x86 it falls back to CPU (slower).

---

### 2. Generate cleaned data

Run the notebooks in order:

```bash
# Clean Unihan
jupyter nbconvert --to notebook --execute src/02_cleaning-data/2025-06-28_unihan.ipynb --inplace

# Clean StarlingDB
jupyter nbconvert --to notebook --execute src/02_cleaning-data/2026-04-05_starlingdb.ipynb --inplace

# Merge and export
jupyter nbconvert --to notebook --execute src/03_playing-with-data/2026-04-05_merge_and_filter.ipynb --inplace
```

### 3. Run locally

```bash
# API
cd app
python3 -m venv .venv && source .venv/bin/activate
pip install -r api/requirements.txt
uvicorn api.main:app --reload

# Frontend (separate terminal)
cd app/frontend
npm install && npm run dev
# → http://localhost:5173
```

### 4. Deploy on NAS (Docker)

```bash
cd app
docker compose up --build
# → http://<nas-ip>:3000
```

Votes are persisted in `app/data/votes.db` on the host.
