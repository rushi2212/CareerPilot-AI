# CAREERPILOT AI

CareerPilot is a career development workspace built around a FastAPI service and a React client. It includes account/profile management, resume analysis, an AI tutor with AI generated quizzes, a private knowledge library, learning roadmaps and progress, mock interviews, remote job discovery, and an application tracker.

## Quick start

1. Copy `.env.example` to `.env` and change `SECRET_KEY`.
2. Run `docker compose up --build`.
3. Open <http://localhost:5173>. API docs: <http://localhost:8000/docs>.

The API uses PostgreSQL when `DATABASE_URL` is configured; SQLite is supported for local development. Resume uploads accept text-based PDF and DOCX files up to 8 MB (scanned PDF OCR is not enabled). Career skill coverage is labeled as a keyword estimate. AI providers are configured server-side with `AI_PROVIDER=openai|groq|gemini`, a matching API key, and optional `AI_MODEL`. Tutor explanations, quizzes, interview feedback, cover notes, resume insights, and roadmaps use the configured model; quizzes label themselves as fallback practice if a model response is unavailable or invalid. Explore Jobs searches the public Himalayas Remote Jobs API from the backend and combines results with saved listings. This feed covers remote jobs and refreshes daily; it does not search the entire internet or include general on-site/hybrid listings. Himalayas attribution and their provided application links are shown in the UI.

## Architecture

See [docs/architecture.md](docs/architecture.md) and [docs/implementation-plan.md](docs/implementation-plan.md). All personal data endpoints require a bearer token and scope data to the authenticated user. Passwords use bcrypt, JWT secrets stay on the server, and resume uploads are stored with opaque user-scoped filenames outside the web root. The external jobs feed is fetched server-side and cached to respect its daily refresh and avoid browser cross-origin restrictions.

## Configuration

See `.env.example`. Never put provider keys in frontend variables. Set `AI_PROVIDER=groq` with `GROQ_API_KEY` to use Groq, or select another supported provider and its matching key. No Himalayas key is required for the public job search feed.
