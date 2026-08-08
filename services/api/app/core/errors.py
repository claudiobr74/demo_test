"""Standardized API errors — never leak PHI/PII in messages."""

from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Autenticação necessária.") -> None:
        super().__init__("UNAUTHORIZED", message, status_code=401)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Você não tem permissão para esta ação.") -> None:
        super().__init__("FORBIDDEN", message, status_code=403)


class NotFoundError(AppError):
    def __init__(self, message: str = "Recurso não encontrado.") -> None:
        super().__init__("NOT_FOUND", message, status_code=404)


class ConflictError(AppError):
    def __init__(self, message: str = "Conflito de dados.", code: str = "CONFLICT") -> None:
        super().__init__(code, message, status_code=409)


class ValidationAppError(AppError):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__("VALIDATION_ERROR", message, status_code=422, details=details)


class TenantIsolationError(AppError):
    def __init__(self) -> None:
        super().__init__(
            "TENANT_ISOLATION_VIOLATION",
            "Acesso cross-tenant negado.",
            status_code=403,
        )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "request_id": request_id,
            "details": exc.details or None,
        },
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.exception("unhandled_error", request_id=request_id, error_type=type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "message": "Erro interno. Nossa equipe foi notificada.",
            "request_id": request_id,
        },
    )
