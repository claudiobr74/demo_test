from fastapi import APIRouter

from app.api.v1 import appointments, auth, patients, sessions, supervisor, today

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(patients.router, prefix="/patients", tags=["patients"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["appointments"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(today.router, prefix="/today", tags=["today"])
api_router.include_router(supervisor.router, prefix="/supervisor", tags=["supervisor"])
