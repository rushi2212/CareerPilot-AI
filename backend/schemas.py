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
