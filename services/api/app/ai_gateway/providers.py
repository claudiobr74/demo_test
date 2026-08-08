"""LLM providers — features never call these directly (only via AI Gateway)."""

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


class GeminiProvider:
    async def complete(
        self,
        *,
        system: str,
        user: str,
        model: str,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        if not settings.gemini_api_key:
            raise AppError(
                "AI_PROVIDER_NOT_CONFIGURED",
                "Chave Gemini não configurada.",
                status_code=503,
            )
        # Strip provider prefix if present (gemini:gemini-2.0-flash)
        model_name = model.split(":", 1)[-1] if model.startswith("gemini:") else model
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model_name}:generateContent?key={settings.gemini_api_key}"
        )
        payload = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
            },
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, json=payload)
        except httpx.HTTPError as exc:
            logger.warning("gemini_http_error", error=str(exc))
            raise AppError(
                "AI_PROVIDER_UNAVAILABLE",
                "Provedor de IA indisponível. Usando modo assistivo local.",
                status_code=503,
            ) from exc

        if resp.status_code >= 400:
            logger.warning("gemini_bad_status", status=resp.status_code)
            raise AppError(
                "AI_PROVIDER_ERROR",
                "Falha no provedor de IA. Usando modo assistivo local.",
                status_code=503,
            )

        data = resp.json()
        try:
            content = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AppError(
                "AI_PROVIDER_ERROR",
                "Resposta Gemini inválida.",
                status_code=503,
            ) from exc
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            parsed = {"summary": {"message": content}}
        usage = data.get("usageMetadata") or {}
        return {
            "content": parsed,
            "raw_text": content,
            "input_tokens": usage.get("promptTokenCount", 0),
            "output_tokens": usage.get("candidatesTokenCount", 0),
            "provider": "gemini",
            "model": model_name,
        }


def resolve_provider(provider_name: str) -> OpenAIProvider | GeminiProvider:
    name = (provider_name or "").lower()
    if name == "openai":
        return OpenAIProvider()
    if name == "gemini":
        return GeminiProvider()
    raise AppError(
        "AI_PROVIDER_NOT_CONFIGURED",
        f"Provedor {provider_name} ainda não está plugado.",
        status_code=503,
    )
