"""AI observability — store metadata + structured outputs, never raw PHI prompts by default."""

from __future__ import annotations

import time
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_gateway import StructuredSupervisorResult
from app.api.deps import AuthContext
from app.core.errors import NotFoundError
from app.core.permissions import Permission
from app.infrastructure.db.models_ops import AiFeedback, AiOutput, AiRequest


class AiObservabilityService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def record_supervisor_run(
        self,
        *,
        mode: str,
        patient_id: uuid.UUID | None,
        result: StructuredSupervisorResult,
        latency_ms: int,
        status: str = "ok",
        error_code: str | None = None,
    ) -> dict:
        """Persist request + output. Structured output is clinical-assistance text already reviewed."""
        meta = result.metadata or {}
        req = AiRequest(
            organization_id=self.auth.organization_id,
            user_id=self.auth.user_id,
            patient_id=patient_id,
            task=mode,
            provider=str(meta.get("provider") or "none"),
            model=str(meta.get("model") or "offline_assist"),
            model_class=str(meta.get("model_class") or "reasoning"),
            input_tokens=int(meta.get("input_tokens") or 0),
            output_tokens=int(meta.get("output_tokens") or 0),
            latency_ms=latency_ms,
            estimated_cost_usd=_estimate_cost(meta),
            status=status,
            engine_version=meta.get("engine_version"),
            framework_version=meta.get("framework_version"),
            prompt_policy_version=meta.get("prompt_policy_version"),
            error_code=error_code,
        )
        self.db.add(req)
        await self.db.flush()

        # Store a minimized structured snapshot (no identifiers beyond clinical suggestions).
        output = AiOutput(
            organization_id=self.auth.organization_id,
            request_id=req.id,
            patient_id=patient_id,
            structured_output={
                "summary": result.summary,
                "suggested_focus": result.suggested_focus,
                "questions": result.questions,
                "hypotheses": result.hypotheses[:10],
                "observations": result.observations[:10],
                "missing_information": result.missing_information,
                "epistemology_note": result.epistemology_note,
            },
            schema_version="1.0",
            safety_flags=result.alerts or [],
            critic_notes=list(meta.get("critic_notes") or []),
        )
        self.db.add(output)
        await self.db.flush()
        return {
            "request_id": str(req.id),
            "output_id": str(output.id),
            "provider": req.provider,
            "model": req.model,
            "latency_ms": latency_ms,
        }

    async def list_for_patient(self, patient_id: uuid.UUID, *, limit: int = 20) -> list[dict]:
        self.auth.require(Permission.AI_SUPERVISION_USE)
        rows = (
            await self.db.execute(
                select(AiRequest, AiOutput)
                .join(AiOutput, AiOutput.request_id == AiRequest.id)
                .where(
                    AiRequest.organization_id == self.auth.organization_id,
                    AiRequest.patient_id == patient_id,
                )
                .order_by(AiRequest.created_at.desc())
                .limit(min(limit, 50))
            )
        ).all()
        return [self._pair_dto(r, o) for r, o in rows]

    async def list_recent(self, *, limit: int = 30) -> list[dict]:
        self.auth.require(Permission.AI_SUPERVISION_USE)
        rows = (
            await self.db.execute(
                select(AiRequest, AiOutput)
                .join(AiOutput, AiOutput.request_id == AiRequest.id)
                .where(AiRequest.organization_id == self.auth.organization_id)
                .order_by(AiRequest.created_at.desc())
                .limit(min(limit, 50))
            )
        ).all()
        return [self._pair_dto(r, o) for r, o in rows]

    async def feedback(self, output_id: uuid.UUID, *, useful: bool, reasons: list | None, comment: str | None) -> dict:
        self.auth.require(Permission.AI_SUPERVISION_USE)
        output = await self.db.get(AiOutput, output_id)
        if output is None or output.organization_id != self.auth.organization_id:
            raise NotFoundError("Saída de IA não encontrada.")
        fb = AiFeedback(
            organization_id=self.auth.organization_id,
            output_id=output.id,
            user_id=self.auth.user_id,
            useful=useful,
            reasons=reasons or [],
            comment=comment,
        )
        self.db.add(fb)
        await self.db.commit()
        return {
            "id": str(fb.id),
            "output_id": str(output_id),
            "useful": useful,
        }

    def _pair_dto(self, r: AiRequest, o: AiOutput) -> dict:
        summary = (o.structured_output or {}).get("summary") or {}
        return {
            "request_id": str(r.id),
            "output_id": str(o.id),
            "patient_id": str(r.patient_id) if r.patient_id else None,
            "task": r.task,
            "provider": r.provider,
            "model": r.model,
            "model_class": r.model_class,
            "status": r.status,
            "latency_ms": r.latency_ms,
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "summary_message": summary.get("message"),
            "suggested_focus": (o.structured_output or {}).get("suggested_focus") or [],
            "safety_flags": o.safety_flags or [],
        }


def _estimate_cost(meta: dict) -> Decimal | None:
    """Rough USD estimate — observability only, not billing."""
    provider = meta.get("provider")
    inn = int(meta.get("input_tokens") or 0)
    out = int(meta.get("output_tokens") or 0)
    if provider == "none" or (inn == 0 and out == 0):
        return Decimal("0")
    # Placeholder rates
    if provider == "openai":
        return Decimal(str(round((inn * 2.5 + out * 10) / 1_000_000, 6)))
    if provider == "gemini":
        return Decimal(str(round((inn * 0.35 + out * 1.05) / 1_000_000, 6)))
    return None


class Timer:
    def __init__(self) -> None:
        self._start = time.perf_counter()

    @property
    def ms(self) -> int:
        return int((time.perf_counter() - self._start) * 1000)
