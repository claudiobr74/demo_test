"""Optional OpenAI provider — features never call this directly."""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import get_logger

logger = get_logger(__name__)


class OpenAIProvider:
    async def complete(
        self,
        *,
        system: str,
        user: str,
        model: str,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        if not settings.openai_api_key:
            raise AppError(
                "AI_PROVIDER_NOT_CONFIGURED",
                "Chave OpenAI não configurada.",
                status_code=503,
            )
        payload = {
            "model": model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.HTTPError as exc:
            logger.warning("openai_http_error", error=str(exc))
            raise AppError(
                "AI_PROVIDER_UNAVAILABLE",
                "Provedor de IA indisponível. Usando modo assistivo local.",
                status_code=503,
            ) from exc

        if resp.status_code >= 400:
            logger.warning("openai_bad_status", status=resp.status_code)
            raise AppError(
                "AI_PROVIDER_ERROR",
                "Falha no provedor de IA. Usando modo assistivo local.",
                status_code=503,
            )

        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            parsed = {"summary": {"message": content}}
        usage = data.get("usage") or {}
        return {
            "content": parsed,
            "raw_text": content,
            "input_tokens": usage.get("prompt_tokens", 0),
            "output_tokens": usage.get("completion_tokens", 0),
            "provider": "openai",
            "model": model,
        }
