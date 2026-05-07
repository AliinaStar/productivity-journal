# productivity-journal

Personal productivity tracking app with AI-generated weekly, monthly, and yearly reports.

Users log daily notes and productivity scores per goal. The backend runs a RAG pipeline (LangGraph + OpenAI) to generate structured reports, using MMR retrieval for historical context and APScheduler for automatic generation.

## Structure

```
bcr-app/
├── packages/
│   ├── backend/   # FastAPI + LangGraph + PostgreSQL
│   └── frontend/  # React Native (Expo) mobile app
```

## Backend

### Stack

- **FastAPI** — REST API
- **PostgreSQL + pgvector** — storage and vector search
- **SQLAlchemy (async) + Alembic** — ORM and migrations
- **LangGraph** — 5-node RAG pipeline
- **OpenAI GPT-4o** — report generation
- **`Alibaba-NLP/gte-multilingual-base`** — embeddings (768-dim)
- **APScheduler** — automatic report generation (cron)
- **Langfuse** — observability
- **Resend** — passwordless email auth (OTP)

### Setup

```bash
cd packages/backend

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux / macOS

# Install dependencies
pip install -e .
```

Create a `.env` file in `packages/backend/`:

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=reporting_system

# OpenAI
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# Langfuse (optional)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=

# App
CORS_ORIGINS=["http://localhost:8081"]
```

### Database

```bash
# Apply all migrations
alembic upgrade head
```

Requires PostgreSQL with the `pgvector` extension enabled:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Run

```bash
uvicorn src.main:app --reload
```

API docs available at `http://localhost:8000/docs`.

### API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/send-code` | Send OTP to email |
| POST | `/auth/verify-code` | Verify OTP, returns `user_id` |
| POST | `/goals` | Create goal |
| PATCH | `/goals/{id}` | Update goal |
| POST | `/entries` | Create entry (auto-embeds note) |
| PATCH | `/entries/{id}` | Update entry (re-embeds if note changed) |
| POST | `/reports/generate` | Run RAG pipeline, save and return report |
| GET | `/reports` | Fetch stored report by period |

All endpoints except `/auth/*` require the `X-User-ID` header (integer user ID returned by `/auth/verify-code`).

### RAG Pipeline

```
START
  ├── week  ──────────────────────────► retrieve_entries
  │                                           │
  └── month / year ──► collect_reports   create_report ──► END
                              │                ▲
                       generate_summary        │
                              │                │
                       retrieve_similar ───────┘
```

- **Week path**: loads current-week entries directly into `create_report`
- **Month / Year path**: fetches sub-period reports from DB → compresses per-goal summaries via LLM → retrieves historical context via MMR → generates report
- **MMR retrieval**: λ = 0.5, balances relevance and diversity across historical entries

### Automatic report generation

APScheduler runs three cron jobs (UTC):

| Period | Schedule |
|--------|----------|
| Week | Monday 00:01 |
| Month | 1st of month 00:01 |
| Year | 1 Jan 00:01 |

Up to 10 pipeline runs execute concurrently; remaining tasks wait in a semaphore queue.

## Frontend

React Native app built with Expo. Stores data locally in SQLite and syncs to the backend on demand.

```bash
cd packages/frontend
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL` in `packages/frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
```

After login, the `user_id` returned by `/auth/verify-code` is stored in local `sync_meta` and sent as `X-User-ID` header on every subsequent request.
