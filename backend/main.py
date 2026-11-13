from fastapi import Depends, FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .config import settings
from .database import Base, engine, get_db
from pathlib import Path
import hashlib
import uuid
import fitz
from docx import Document
from io import BytesIO
from .config import settings
from .models import CareerGoal, User, UserProfile, Resume, ResumeAnalysis, LearningPath, LearningTask
from .schemas import AnalyzeResumeIn, GoalIn, LoginIn, ProfileUpdate, RegisterIn, RoadmapIn, TaskProgressIn, TokenOut
from .security import create_access_token, hash_password, token_user_id, verify_password
from .career import analyze_resume, build_roadmap

Base.metadata.create_all(bind=engine)
app = FastAPI(title="CareerPilot AI API", version="0.1.0", description="Career development platform API")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=True, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Authorization", "Content-Type"])
bearer = HTTPBearer(auto_error=False)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Sign in to continue")
    try:
        user_id = token_user_id(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Account not found")
    return user


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "careerpilot-api"}


@app.post("/api/v1/auth/register", response_model=TokenOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password), profile=UserProfile(full_name=payload.full_name.strip()))
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    return TokenOut(access_token=create_access_token(user.id))


@app.post("/api/v1/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return TokenOut(access_token=create_access_token(user.id))


@app.get("/api/v1/auth/me")
def me(user: User = Depends(current_user)):
    profile = user.profile
    return {"id": user.id, "email": user.email, "role": user.role, "full_name": profile.full_name if profile else "", "target_role": profile.target_role if profile else "", "experience_level": profile.experience_level if profile else "Early career"}


@app.put("/api/v1/profile")
def update_profile(payload: ProfileUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not user.profile:
        user.profile = UserProfile(full_name=payload.full_name)
    user.profile.full_name = payload.full_name.strip()
    user.profile.target_role = payload.target_role.strip()
    user.profile.experience_level = payload.experience_level
    db.commit()
    return {"full_name": user.profile.full_name, "target_role": user.profile.target_role, "experience_level": user.profile.experience_level}


@app.get("/api/v1/career/goals")
def list_goals(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [{"id": g.id, "title": g.title, "status": g.status} for g in db.scalars(select(CareerGoal).where(CareerGoal.user_id == user.id).order_by(CareerGoal.created_at.desc()))]


@app.post("/api/v1/career/goals", status_code=201)
def add_goal(payload: GoalIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    goal = CareerGoal(user_id=user.id, title=payload.title.strip())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return {"id": goal.id, "title": goal.title, "status": goal.status}


def _resume_output(resume: Resume):
    return {"id": resume.id, "filename": resume.original_name, "uploaded_at": resume.uploaded_at.isoformat(), "has_text": bool(resume.extracted_text)}


@app.post("/api/v1/resume/upload", status_code=201)
async def upload_resume(file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)):
    filename = Path(file.filename or "resume").name[:255]
    suffix = Path(filename).suffix.lower()
    if suffix not in (".pdf", ".docx"):
        raise HTTPException(status_code=415, detail="Upload a PDF or DOCX resume")
    content = await file.read(settings.max_upload_bytes + 1)
    await file.close()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Resume must be 8 MB or smaller")
    try:
        if suffix == ".pdf":
            if not content.startswith(b"%PDF-"):
                raise ValueError("Invalid PDF signature")
            with fitz.open(stream=content, filetype="pdf") as pdf:
                if len(pdf) > 40:
                    raise ValueError("Resume PDF cannot exceed 40 pages")
                extracted = "\n".join(page.get_text() for page in pdf)
        else:
            if not content.startswith(b"PK"):
                raise ValueError("Invalid DOCX signature")
            doc = Document(BytesIO(content))
            extracted = "\n".join(p.text for p in doc.paragraphs)
            extracted += "\n" + "\n".join(" | ".join(cell.text for cell in row.cells) for table in doc.tables for row in table.rows)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not read resume: {str(exc)[:180]}")
    if not extracted.strip():
        raise HTTPException(status_code=422, detail="No selectable text found. OCR for scanned resumes is not enabled yet.")
    upload_root = Path(settings.uploads_dir).resolve()
    upload_root.mkdir(parents=True, exist_ok=True)
    object_name = f"{user.id}-{uuid.uuid4().hex}{suffix}"
    full_path = upload_root / object_name
    full_path.write_bytes(content)
    resume = Resume(user_id=user.id, original_name=filename, stored_path=str(full_path), sha256=hashlib.sha256(content).hexdigest(), extracted_text=extracted[:100000])
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return _resume_output(resume)


@app.get("/api/v1/resume")
def list_resumes(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [_resume_output(item) for item in db.scalars(select(Resume).where(Resume.user_id == user.id).order_by(Resume.uploaded_at.desc()))]


@app.delete("/api/v1/resume/{resume_id}", status_code=204)
def delete_resume(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    resume = db.scalar(select(Resume).where(Resume.id == resume_id, Resume.user_id == user.id))
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    stored_path = Path(resume.stored_path)
    resume_root = Path(settings.uploads_dir).resolve()
    try:
        if stored_path.resolve().parent == resume_root and stored_path.exists():
            stored_path.unlink()
    except OSError:
        pass
    db.delete(resume)
    db.commit()


@app.post("/api/v1/resume/analyze")
def analyze_uploaded_resume(payload: AnalyzeResumeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    resume = db.scalar(select(Resume).where(Resume.id == payload.resume_id, Resume.user_id == user.id))
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    result = analyze_resume(resume.extracted_text, payload.target_role.strip())
    row = ResumeAnalysis(resume_id=resume.id, user_id=user.id, target_role=payload.target_role.strip(), result=result)
    db.add(row)
    if user.profile:
        user.profile.target_role = payload.target_role.strip()
    db.commit()
    db.refresh(row)
    return {"id": row.id, **result}


@app.get("/api/v1/resume/{resume_id}/analysis")
def get_resume_analysis(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(ResumeAnalysis).where(ResumeAnalysis.resume_id == resume_id, ResumeAnalysis.user_id == user.id).order_by(ResumeAnalysis.created_at.desc()))
    if not row:
        raise HTTPException(status_code=404, detail="No analysis found for this resume")
    return {"id": row.id, **row.result}


@app.post("/api/v1/career/analyze")
def career_analyze(payload: AnalyzeResumeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return analyze_uploaded_resume(payload, user, db)


@app.post("/api/v1/career/roadmap", status_code=201)
def create_roadmap(payload: RoadmapIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    analysis = None
    if payload.analysis_id:
        analysis = db.scalar(select(ResumeAnalysis).where(ResumeAnalysis.id == payload.analysis_id, ResumeAnalysis.user_id == user.id))
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
    else:
        analysis = db.scalar(select(ResumeAnalysis).where(ResumeAnalysis.user_id == user.id, ResumeAnalysis.target_role == payload.target_role).order_by(ResumeAnalysis.created_at.desc()))
    missing = analysis.result.get("missing_skills", []) if analysis else []
    tasks = build_roadmap(payload.target_role, missing)
    path = LearningPath(user_id=user.id, target_role=payload.target_role.strip(), source_analysis_id=analysis.id if analysis else None)
    path.tasks = [LearningTask(user_id=user.id, title=item["title"], description=item["description"], priority=item["priority"], estimated_hours=item["estimated_hours"], resource_url=item.get("resource_url") or "", sort_order=index) for index, item in enumerate(tasks)]
    db.add(path)
    if user.profile:
        user.profile.target_role = payload.target_role.strip()
    db.commit()
    db.refresh(path)
    return {"id": path.id, "target_role": path.target_role, "tasks": [{"id": t.id, "title": t.title, "description": t.description, "priority": t.priority, "estimated_hours": t.estimated_hours, "resource_url": t.resource_url, "status": t.status} for t in path.tasks]}


@app.get("/api/v1/learning/roadmap")
def get_roadmap(user: User = Depends(current_user), db: Session = Depends(get_db)):
    path = db.scalar(select(LearningPath).where(LearningPath.user_id == user.id).order_by(LearningPath.created_at.desc()))
    if not path:
        return None
    return {"id": path.id, "target_role": path.target_role, "tasks": [{"id": t.id, "title": t.title, "description": t.description, "priority": t.priority, "estimated_hours": t.estimated_hours, "resource_url": t.resource_url, "status": t.status} for t in sorted(path.tasks, key=lambda x: x.sort_order)]}


@app.post("/api/v1/learning/progress")
def update_progress(payload: TaskProgressIn, task_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    task = db.scalar(select(LearningTask).where(LearningTask.id == task_id, LearningTask.user_id == user.id))
    if not task:
        raise HTTPException(status_code=404, detail="Learning task not found")
    task.status = payload.status
    db.commit()
    return {"id": task.id, "status": task.status}


@app.get("/api/v1/dashboard/overview")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    goals = list(db.scalars(select(CareerGoal).where(CareerGoal.user_id == user.id).order_by(CareerGoal.created_at.desc()).limit(5)))
    latest_analysis = db.scalar(select(ResumeAnalysis).where(ResumeAnalysis.user_id == user.id).order_by(ResumeAnalysis.created_at.desc()))
    latest_path = db.scalar(select(LearningPath).where(LearningPath.user_id == user.id).order_by(LearningPath.created_at.desc()))
    provider = settings.ai_provider if settings.ai_provider and getattr(settings, f"{settings.ai_provider.lower()}_api_key", "") else "not_configured"
    return {"profile": {"full_name": user.profile.full_name if user.profile else "", "target_role": user.profile.target_role if user.profile else ""}, "goal_count": db.scalar(select(func.count()).select_from(CareerGoal).where(CareerGoal.user_id == user.id)) or 0, "goals": [{"id": g.id, "title": g.title, "status": g.status} for g in goals], "readiness": latest_analysis.result.get("readiness_score") if latest_analysis else None, "readiness_note": "Keyword coverage estimate for your selected role; not a hiring prediction." if latest_analysis else "Add your resume and choose a target role to calculate your skill coverage.", "resume_count": db.scalar(select(func.count()).select_from(Resume).where(Resume.user_id == user.id)) or 0, "roadmap_task_count": len(latest_path.tasks) if latest_path else 0, "integrations": {"ai_provider": provider}}
