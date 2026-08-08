"""Structured logging with PHI/PII redaction."""

from __future__ import annotations

import logging
import re
from typing import Any

import structlog

from app.core.config import settings

SENSITIVE_KEYS = frozenset(
    {
        "password",
        "token",
        "access_token",
        "refresh_token",
        "authorization",
        "secret",
        "api_key",
        "cpf",
        "phone",
        "email",
        "address",
        "transcript",
        "clinical_note",
        "evolution",
        "prompt",
        "ai_response",
        "content",
        "notes",
    }
)

EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_RE = re.compile(r"\b\d{2,3}[\s-]?\d{4,5}[\s-]?\d{4}\b")


def _redact_value(key: str, value: Any) -> Any:
    if key.lower() in SENSITIVE_KEYS:
        return "[REDACTED]"
    if isinstance(value, str):
        value = EMAIL_RE.sub("[EMAIL]", value)
        value = PHONE_RE.sub("[PHONE]", value)
        if len(value) > 500:
            return value[:500] + "…[truncated]"
    return value


def redact_processor(
    _logger: Any, _method: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    return {k: _redact_value(k, v) for k, v in event_dict.items()}


def configure_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    shared = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        redact_processor,
        structlog.processors.StackInfoRenderer(),
    ]
    if settings.log_json:
        processors = [*shared, structlog.processors.JSONRenderer()]
    else:
        processors = [*shared, structlog.dev.ConsoleRenderer()]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
