from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./careerpilot.db"
    secret_key: str = "local-development-only-change-this-secret"
    access_token_expire_minutes: int = 60
    frontend_origin: str = "http://localhost:5173"
    uploads_dir: str = "./data/uploads"
    max_upload_bytes: int = 8 * 1024 * 1024
    ai_provider: str = ""
    ai_model: str = ""
    openai_api_key: str = ""
    groq_api_key: str = ""
    gemini_api_key: str = ""
    environment: str = "development"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    redis_url: str = "redis://localhost:6379/0"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    code_executor_url: str = ""
    code_executor_api_key: str = ""
    langsmith_api_key: str = ""
    langsmith_project: str = "careerpilot"

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.environment.lower() == "production" and (self.secret_key == "local-development-only-change-this-secret" or len(self.secret_key) < 32):
            raise ValueError("Production requires SECRET_KEY with at least 32 characters")
        return self


settings = Settings()
