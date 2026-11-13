# Deploy CareerPilot on Render

CareerPilot is configured as a Render Blueprint in the repository-root `render.yaml`. It creates a static React site, a Docker-based FastAPI service, managed PostgreSQL, and a private Qdrant vector store. The API and Qdrant each receive a persistent disk so uploaded resumes, learning documents, and vectors survive restarts and deploys.

## Deploy through GitHub

1. Push the project to a GitHub repository. Keep `.env` out of Git; it is ignored by `.gitignore`.
2. In Render, choose **New → Blueprint**, connect the GitHub repository, and select its branch.
3. Review the Blueprint resources and their plans before creating them.
4. Enter `GROQ_API_KEY` and `CODE_EXECUTOR_API_KEY` when Render prompts for the secrets. The Blueprint generates `SECRET_KEY` and connects the internal Postgres and Qdrant services automatically.
5. Deploy. Render builds the frontend with the generated API URL, runs Alembic migrations before starting the API, and exposes the frontend and API URLs when deployment finishes.

## Cost and storage

The Blueprint uses paid plans for the API, Qdrant, and Postgres because Render's free services do not provide persistent disks, and free Postgres expires after 30 days. With the smallest configured plans and two 1 GB disks, the current Render price list estimates about **$20.50 USD/month**, before any additional usage or Groq charges. Confirm the total in Render's resource review before creating services. You can reduce plans or disk sizes in `render.yaml` before deploying, with corresponding performance or storage tradeoffs.

Render's static site is free. The API's upload disk stores resumes and source documents; Qdrant's disk stores knowledge vectors. Postgres stores the application records. The cache of remote job listings is in memory and is safe to lose between API restarts.

## Environment variables

Render supplies `DATABASE_URL` and `QDRANT_URL` from internal services. The Blueprint generates `SECRET_KEY`, sets `ENVIRONMENT=production`, configures the frontend origin and upload path, and sets `AI_PROVIDER=groq`. Provide the two secret API keys through the Render Blueprint prompt; do not add them to this file or the repository.

The API health check is `GET /api/v1/health`. If using a different static-site hostname, Render's Blueprint reference keeps `FRONTEND_ORIGIN` synced to the deployed site URL.
