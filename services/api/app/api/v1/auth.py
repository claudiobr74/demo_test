from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import LoginRequest, RegisterRequest
from app.application.auth_service import AuthService
from app.infrastructure.db.session import get_db

router = APIRouter()


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    service = AuthService(db)
    return await service.register_organization(
        organization_name=body.organization_name,
        email=str(body.email),
        password=body.password,
        full_name=body.full_name,
        default_framework=body.default_framework,
        kind=body.kind,
    )


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> dict:
    service = AuthService(db)
    return await service.login(
        email=str(body.email),
        password=body.password,
        organization_id=body.organization_id,
    )
