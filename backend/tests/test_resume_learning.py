from io import BytesIO
import pytest
from docx import Document
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app import career


@pytest.fixture
def client(monkeypatch):
    # Ensure tests never call a paid external model, even if a developer has a key in .env.
    monkeypatch.setattr(career, "generate_json", lambda *_args, **_kwargs: None)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def account(client, email):
    response = client.post("/api/v1/auth/register", json={"email": email, "password": "StrongTestPass123!", "full_name": "Test User"})
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def docx_bytes():
    doc = Document()
    doc.add_heading("Alex Morgan", 0)
    doc.add_heading("Skills", level=1)
    doc.add_paragraph("React, TypeScript, JavaScript, HTML, CSS, and Git")
    doc.add_heading("Projects", level=1)
    doc.add_paragraph("Built an accessible React dashboard used by 120 customers.")
    doc.add_heading("Experience", level=1)
    doc.add_paragraph("Frontend developer for two years.")
    output = BytesIO()
    doc.save(output)
    return output.getvalue()


def test_resume_to_roadmap_and_progress_are_persisted_and_scoped(client):
    owner = account(client, "owner@example.com")
    other = account(client, "other@example.com")
    upload = client.post("/api/v1/resume/upload", headers=owner, files={"file": ("resume.docx", docx_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
    assert upload.status_code == 201, upload.text
    resume_id = upload.json()["id"]
    assert client.get("/api/v1/resume", headers=other).json() == []

    analysis = client.post("/api/v1/resume/analyze", headers=owner, json={"resume_id": resume_id, "target_role": "Frontend Developer"})
    assert analysis.status_code == 200, analysis.text
    assert "React" in analysis.json()["skills"]
    assert analysis.json()["analysis_mode"] == "transparent_rules"
    assert client.get(f"/api/v1/resume/{resume_id}/analysis", headers=other).status_code == 404

    roadmap = client.post("/api/v1/career/roadmap", headers=owner, json={"target_role": "Frontend Developer", "analysis_id": analysis.json()["id"]})
    assert roadmap.status_code == 201, roadmap.text
    task_id = roadmap.json()["tasks"][0]["id"]
    progress = client.post(f"/api/v1/learning/progress?task_id={task_id}", headers=owner, json={"status": "done"})
    assert progress.status_code == 200 and progress.json()["status"] == "done"
    assert client.post(f"/api/v1/learning/progress?task_id={task_id}", headers=other, json={"status": "done"}).status_code == 404
    assert client.get("/api/v1/learning/roadmap", headers=owner).json()["tasks"][0]["status"] == "done"


def test_upload_rejects_unsupported_and_oversized_content(client):
    owner = account(client, "upload@example.com")
    assert client.post("/api/v1/resume/upload", headers=owner, files={"file": ("notes.txt", b"not a resume", "text/plain")}).status_code == 415
    assert client.post("/api/v1/resume/upload", headers=owner, files={"file": ("notes.pdf", b"not pdf", "application/pdf")}).status_code == 422
