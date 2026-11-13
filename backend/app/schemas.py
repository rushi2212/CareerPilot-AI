from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileOut(BaseModel):
    email: EmailStr
    full_name: str
    target_role: str
    experience_level: str
    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    target_role: str = Field(default="", max_length=160)
    experience_level: str = Field(default="Early career", max_length=40)


class GoalIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)


class AnalyzeResumeIn(BaseModel):
    resume_id: int
    target_role: str = Field(min_length=2, max_length=160)


class RoadmapIn(BaseModel):
    target_role: str = Field(min_length=2, max_length=160)
    analysis_id: int | None = None


class TaskProgressIn(BaseModel):
    status: str = Field(pattern="^(todo|in_progress|done)$")


class InterviewStartIn(BaseModel):
    role: str = Field(min_length=2, max_length=160)
    interview_type: str = Field(default="technical", pattern="^(technical|behavioral|hr|system_design)$")
    difficulty: str = Field(default="intermediate", pattern="^(beginner|intermediate|advanced)$")


class InterviewAnswerIn(BaseModel):
    answer: str = Field(min_length=2, max_length=8000)


class TutorChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=6000)
    session_id: str | None = None
    topic: str = Field(default="", max_length=160)


class TutorQuizIn(BaseModel):
    topic: str = Field(min_length=2, max_length=160)
    answers: list[int] | None = None
    questions: list[dict] | None = None


class JobIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    company: str = Field(min_length=1, max_length=160)
    location: str = Field(default="", max_length=160)
    work_mode: str = Field(default="unspecified", max_length=30)
    description: str = Field(min_length=20, max_length=12000)
    source_url: str = Field(default="", max_length=1000)


class ApplicationIn(BaseModel):
    job_id: int | None = None
    job_title: str = Field(min_length=2, max_length=200)
    company: str = Field(min_length=1, max_length=160)
    source_url: str = Field(default="", max_length=1000)


class ApplicationUpdate(BaseModel):
    stage: str = Field(pattern="^(saved|applied|interviewing|offer|rejected|withdrawn)$")


class RagQueryIn(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    limit: int = Field(default=5, ge=1, le=10)
