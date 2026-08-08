"""Request dependencies — auth context resolved from JWT only."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.permissions import Permission
from app.core.security import decode_token
from app.infrastructure.db.models_identity import Membership, User
from app.infrastructure.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True, slots=True)
class AuthContext:
    user_id: uuid.UUID
    organization_id: uuid.UUID
    membership_id: uuid.UUID
    permissions: frozenset[str]
    user: User
    membership: Membership
    request_id: str | None = None

    def has(self, permission: Permission | str) -> bool:
        key = permission.value if isinstance(permission, Permission) else permission
        return key in self.permissions

    def require(self, *permissions: Permission | str) -> None:
        missing = [p for p in permissions if not self.has(p)]
        if missing:
            raise ForbiddenError()


async def get_current_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> AuthContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError()

    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise UnauthorizedError("Token de acesso inválido.")

    try:
        user_id = uuid.UUID(payload["sub"])
        organization_id = uuid.UUID(payload["org"])
        membership_id = uuid.UUID(payload["mid"])
    except (KeyError, ValueError) as exc:
        raise UnauthorizedError("Claims inválidos.") from exc

    result = await db.execute(
        select(Membership)
        .where(
            Membership.id == membership_id,
            Membership.user_id == user_id,
            Membership.organization_id == organization_id,
            Membership.is_active.is_(True),
        )
        .options(selectinload(Membership.user))
    )
    membership = result.scalar_one_or_none()
    if membership is None or not membership.user.is_active:
        raise UnauthorizedError("Sessão inválida.")

    # Always use DB permissions as source of truth (JWT perms are a hint for UX only).
    perms = frozenset(membership.permissions)
    request.state.organization_id = organization_id
    request.state.user_id = user_id

    return AuthContext(
        user_id=user_id,
        organization_id=organization_id,
        membership_id=membership_id,
        permissions=perms,
        user=membership.user,
        membership=membership,
        request_id=getattr(request.state, "request_id", None),
    )


def require_permissions(*permissions: Permission):
    async def _dependency(auth: AuthContext = Depends(get_current_auth)) -> AuthContext:
        auth.require(*permissions)
        return auth

    return _dependency
