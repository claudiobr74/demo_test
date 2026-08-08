from fastapi import APIRouter

from app.api.v1 import (
    ai_observability,
    appointments,
    auth,
    case_memory,
    clinical_records,
    confirmations,
    consents,
    documents,
    finance,
    formulations,
    hypotheses,
    patients,
    sessions,
    supervisor,
    today,
    treatment_plans,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(patients.router, prefix="/patients", tags=["patients"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["appointments"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(today.router, prefix="/today", tags=["today"])
api_router.include_router(supervisor.router, prefix="/supervisor", tags=["supervisor"])
api_router.include_router(ai_observability.router, prefix="/ai", tags=["ai"])
api_router.include_router(consents.router, prefix="/consents", tags=["consents"])
api_router.include_router(clinical_records.router, prefix="/clinical-records", tags=["clinical-records"])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(case_memory.router, prefix="/case-memory", tags=["case-memory"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(formulations.router, prefix="/formulations", tags=["formulations"])
api_router.include_router(treatment_plans.router, prefix="/treatment-plans", tags=["treatment-plans"])
api_router.include_router(hypotheses.router, prefix="/hypotheses", tags=["hypotheses"])
api_router.include_router(confirmations.router, prefix="/confirmations", tags=["confirmations"])
