# AI Knowledge Workspace

RAG-based knowledge base: upload PDF/Markdown documents, ask questions, get answers with citations back to the source.

## Stack

- **Frontend**: React + Vite + TypeScript, react-router, zustand, react-markdown
- **Backend**: FastAPI (async), SQLAlchemy 2.0, Alembic
- **Storage**: PostgreSQL + pgvector (documents, chunks, embeddings), Redis (reserved for caching/background jobs)
- **LLM**: OpenAI-compatible API (chat completions + embeddings) — swap `OPENAI_BASE_URL` for any compatible provider

## Local setup

### 1. Infra

```bash
docker compose up -d
```

Starts Postgres (with pgvector) on `5432` and Redis on `6379`.

### 2. Backend

```bash
cd Backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# edit .env and set OPENAI_API_KEY
venv\Scripts\alembic upgrade head
venv\Scripts\uvicorn app.main:app --reload
```

API runs at `http://localhost:8000`, docs at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd Fontend
npm install
copy .env.example .env
npm run dev
```

App runs at `http://localhost:5173`.

## MVP scope (v1)

- [x] Auth (register/login, JWT)
- [x] Upload PDF/Markdown -> chunk -> embed -> store in pgvector
- [x] RAG chat with streaming responses and inline citations
- [ ] Notes / knowledge graph (v2)
- [ ] Web search / calculator agent tools (v2)
- [ ] Usage dashboard, model switcher (v2)

## Project layout

```
Backend/
  app/
    core/       # config, security
    db/         # SQLAlchemy session/base
    models/     # ORM models (User, Document, Chunk, Conversation, Message)
    schemas/    # Pydantic request/response models
    api/routes/ # auth, documents, chat
    services/   # chunking, embeddings, LLM client, retrieval
  alembic/      # migrations

Fontend/
  src/
    pages/      # Login, Register, Documents, Chat
    components/ # Layout, ProtectedRoute
    store/      # zustand auth store
    lib/        # axios client
```
