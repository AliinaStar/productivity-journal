# BCR — Productivity Journal

Personal productivity tracking app with AI-generated weekly, monthly, and yearly reports.

Users log daily notes and productivity scores per goal. The backend generates structured analytical reports using a RAG pipeline (LangGraph + OpenAI GPT), with MMR-based semantic retrieval for historical context.

## Architecture

```
bcr-app/
├── packages/
│   ├── backend/    # FastAPI · PostgreSQL + pgvector · LangGraph · Docker
│   └── frontend/   # React Native (Expo) · SQLite · local-first sync
```

The frontend stores all data locally in SQLite and syncs to the backend on demand. Authentication is passwordless — the user enters their email and receives a 6-digit OTP.

## Quick start (development)

### 1. Backend (Docker)

```bash
cd packages/backend
cp .env.example .env
# Fill in OPENAI_API_KEY, RESEND_API_KEY and EMAIL_FROM in .env
# Set APP_ENV=development to skip OTP during development

docker compose up --build
```

API is available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 2. Frontend (Expo)

```bash
cd packages/frontend
npm install
cp .env.example .env
# EXPO_PUBLIC_API_URL is auto-detected from Expo's Metro host in __DEV__ mode
# so you usually don't need to edit it

npx expo start
```

Scan the QR code with Expo Go (Android / iOS) or press `a` / `i` for emulators.

> **Note:** in `development` mode the backend exposes `POST /auth/dev-login` which skips OTP — just enter any email and you're in.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo Router |
| Local DB | SQLite via `expo-sqlite` |
| Backend API | FastAPI (Python 3.11) |
| Database | PostgreSQL 17 + pgvector |
| ORM | SQLAlchemy (async) + Alembic |
| RAG pipeline | LangGraph |
| LLM | OpenAI GPT-4o |
| Embeddings | `Alibaba-NLP/gte-multilingual-base` (768-dim) |
| Scheduler | APScheduler (cron) |
| Email | Resend (OTP auth) |
| Observability | Langfuse |
| Containerisation | Docker Compose |

## Repository structure

```
packages/
├── backend/
│   ├── src/
│   │   ├── api/          # FastAPI app factory, lifespan
│   │   ├── core/         # settings, auth dependency, email
│   │   ├── db/           # SQLAlchemy models, session, migrations
│   │   ├── rag/          # embeddings, retrieval, LangGraph pipeline,
│   │   │                 # scheduler, prompts, schemas
│   │   └── routes/       # auth, goals, entries, reports, users, health
│   ├── alembic/          # DB migrations
│   ├── notebooks/        # RAG experiments and evaluation
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── pyproject.toml
└── frontend/
    ├── app/              # Expo Router screens (login, onboarding,
    │                     # goals, notes, summary/week|month|year)
    ├── api-client/       # typed fetch wrappers for each resource
    ├── db/               # SQLite schema + query hooks
    ├── hooks/            # useSync — push/pull logic
    ├── components/       # shared UI components
    ├── i18n/             # English / Ukrainian translations
    └── utils/
```

## See also

- [Backend README](packages/backend/README.md) — full API reference, RAG pipeline, scheduler
- [Frontend README](packages/frontend/README.md) — screens, sync model, environment config
