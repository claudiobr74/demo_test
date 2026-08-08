"""Application configuration — secrets via env / Secret Manager, never in Flutter."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    app_name: str = "SerenaPsi API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://serenapsi:serenapsi@localhost:5432/serenapsi"
    database_url_sync: str = "postgresql://serenapsi:serenapsi@localhost:5432/serenapsi"

    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    bcrypt_rounds: int = 12

    cors_origins: str = "http://localhost:3000,http://localhost:8080"

    ai_enabled: bool = False
    ai_fast_model: str = "openai:gpt-4o-mini"
    ai_reasoning_model: str = "openai:gpt-4o"
    ai_deep_reasoning_model: str = "openai:o1"
    ai_default_provider: str = "openai"
    openai_api_key: str = ""
    gemini_api_key: str = ""

    log_level: str = "INFO"
    log_json: bool = False

    @field_validator("jwt_secret")
    @classmethod
    def jwt_secret_not_default_in_prod(cls, value: str, info) -> str:  # type: ignore[no-untyped-def]
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
