# Implementation status

## Implemented in this repository

- Account registration, sign-in, authenticated profile updates, password change, and account deletion.
- Redis-backed per-IP rate limits for registration, sign-in, and password changes.
- PostgreSQL/SQLite persistence, Alembic startup migrations, and Docker Compose services for PostgreSQL, Redis, Qdrant, API, and web client.
- User-scoped resume upload and extraction, resume skill coverage, learning roadmaps, task progress, tutor chat/history/quizzes, and progress analytics.
- Adaptive mock interviews with text answers, model-assisted feedback, optional browser speech controls, and saved reports.
- User-managed job listings, application tracking, and AI-assisted cover-note drafts. The app does not scrape sites or send applications.
- Private knowledge library with PDF/DOCX/TXT/Markdown extraction, Qdrant embeddings, tenant-filtered retrieval, cited answers, retry indexing, and deletion.
- Code Arena client and authenticated execution proxy with strict language/source limits, bounded request time, and no API-process execution.
- Server-side OpenAI/Groq/Gemini adapter. The configured provider is selected with `AI_PROVIDER`; secrets stay on the API server.

## Still needs a service or product decision

- Account recovery by email requires an SMTP or transactional-email provider and verified sender configuration. Password changes are available while signed in.
- Code Arena uses the configured external execution provider through the server-side adapter in `docs/code-runner-contract.md`. The API intentionally does not execute user code itself; provider credentials, quotas, and current service availability still affect execution.
- Browser speech recognition and speech synthesis depend on browser support. Managed STT/TTS requires provider credentials and integration.
- Job-board imports require a permitted feed/API and its credentials. Current job listings are user supplied.
- LangGraph workflows, LangSmith tracing, and MCP tool servers are not enabled. LangSmith configuration is optional and does not itself add workflow or tool integrations.
- Production operations remain: deployment, backups, secret management, monitoring, CI, and end-to-end verification against live services.

## Migration notes

The API container runs `alembic upgrade head` before serving. Revision `0001_current_schema` creates missing tables without dropping existing tables or data. Future model changes must be made through new explicit Alembic revisions; the baseline is not an autogeneration mechanism.
