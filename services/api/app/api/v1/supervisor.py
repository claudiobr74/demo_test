from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_gateway import SupervisorMode, gateway
from app.api.deps import AuthContext, require_permissions
from app.api.v1.schemas import SupervisorRequest
from app.application.ai_observability_service import AiObservabilityService, Timer
from app.application.audit import write_audit
from app.application.clinical_hypothesis_service import ClinicalHypothesisService
from app.application.session_service import SessionService
from app.core.errors import ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.post("/run")
async def run_supervisor(
    body: SupervisorRequest,
    auth: AuthContext = Depends(require_permissions(Permission.AI_SUPERVISION_USE)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        mode = SupervisorMode(body.mode)
    except ValueError as exc:
        raise ValidationAppError("Modo do Supervisor inválido.") from exc

    framework = body.framework or auth.user.default_framework
    context = dict(body.context)
    if body.patient_id:
        prep = await SessionService(db, auth).prepare_context(body.patient_id)
        context = {**prep, **context}
        context["patient_code"] = prep["patient"]["display_name"].split("•")[-1].strip()
        framework = prep["patient"]["framework"] or framework

    timer = Timer()
    result = await gateway.run_supervisor(
        mode=mode,
        framework_id=framework,
        raw_context=context,
        user_message=body.message,
    )
    latency_ms = timer.ms

    obs = await AiObservabilityService(db, auth).record_supervisor_run(
        mode=mode.value,
        patient_id=body.patient_id,
        result=result,
        latency_ms=latency_ms,
    )

    imported: list[dict] = []
    if body.patient_id and body.import_hypotheses and result.hypotheses:
        imported = await ClinicalHypothesisService(db, auth).import_from_supervisor(
            body.patient_id, result.hypotheses
        )

    await write_audit(
        db,
        organization_id=auth.organization_id,
        actor_user_id=auth.user_id,
        action="ai.supervisor.run",
        resource_type="ai_supervisor",
        resource_id=mode.value,
        request_id=auth.request_id,
        metadata={
            "framework": framework,
            "offline": result.metadata.get("provider") == "none",
            "ai_request_id": obs["request_id"],
            "latency_ms": latency_ms,
        },
    )
    await db.commit()
    payload = result.to_dict()
    payload["observability"] = obs
    if imported:
        payload["imported_hypotheses"] = imported
    return payload


@router.get("/modes")
async def list_modes(
    auth: AuthContext = Depends(require_permissions(Permission.AI_SUPERVISION_USE)),
) -> dict:
    _ = auth
    return {
        "modes": [
            {"id": m.value, "label": _MODE_LABELS[m]}
            for m in SupervisorMode
        ]
    }


_MODE_LABELS = {
    SupervisorMode.PREPARE_SESSION: "Preparar próxima sessão",
    SupervisorMode.POST_SESSION_DEBRIEF: "Debriefing pós-sessão",
    SupervisorMode.CASE_FORMULATION: "Formulação de caso",
    SupervisorMode.LONGITUDINAL_REVIEW: "Revisão longitudinal",
    SupervisorMode.STUCK_CASE: "Estou travada neste caso",
    SupervisorMode.TREATMENT_PLANNING: "Planejamento terapêutico",
    SupervisorMode.CLINICAL_CHAT: "Perguntar ao Supervisor",
    SupervisorMode.REVIEW_MY_CONDUCT: "Revisar minha conduta",
}
