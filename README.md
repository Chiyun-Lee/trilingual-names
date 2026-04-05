# trilingual-names

A tool for exploring and curating Chinese character data across Mandarin (pinyin), Korean (hangul), and Japanese (katakana) pronunciation systems.

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

### 1. Generate cleaned data

Run the notebooks in order:

```bash
# Clean Unihan
jupyter nbconvert --to notebook --execute src/02_cleaning-data/2025-06-28_unihan.ipynb --inplace

# Clean StarlingDB
jupyter nbconvert --to notebook --execute src/02_cleaning-data/2026-04-05_starlingdb.ipynb --inplace

# Merge and export
jupyter nbconvert --to notebook --execute src/03_playing-with-data/2026-04-05_merge_and_filter.ipynb --inplace
```

### 2. Run locally

```bash
# API
cd app
python3 -m venv .venv && source .venv/bin/activate
pip install -r api/requirements.txt
cd api && uvicorn main:app --reload

# Frontend (separate terminal)
cd app/frontend
npm install && npm run dev
# → http://localhost:5173
```

### 3. Deploy on NAS (Docker)

```bash
cd app
docker compose up --build
# → http://<nas-ip>:3000
```

Votes are persisted in `app/data/votes.db` on the host.

## TODO

- Create database and enable writes
