"""Authentication & organization onboarding."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, UnauthorizedError, ValidationAppError
from app.core.permissions import ROLE_PERMISSIONS, Permission
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.infrastructure.db.models_identity import Membership, Organization, User
from app.application.audit import write_audit

_SLUG_RE = re.compile(r"[^a-z0-9-]+")


def _slugify(name: str) -> str:
    base = name.lower().strip().replace(" ", "-")
    slug = _SLUG_RE.sub("", base)[:80] or "clinica"
    return f"{slug}-{uuid.uuid4().hex[:6]}"


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def register_organization(
        self,
        *,
        organization_name: str,
        email: str,
        password: str,
        full_name: str,
        default_framework: str = "cbt",
        kind: str = "individual",
    ) -> dict:
        if len(password) < 10:
            raise ValidationAppError("A senha deve ter pelo menos 10 caracteres.")

        existing = await self.db.execute(select(User).where(User.email == email.lower()))
        if existing.scalar_one_or_none():
            raise ConflictError("Já existe uma conta com este e-mail.", code="EMAIL_TAKEN")

        org = Organization(
            name=organization_name.strip(),
            slug=_slugify(organization_name),
            kind=kind,
            settings={"onboarding_completed": False},
        )
        user = User(
            email=email.lower().strip(),
            password_hash=hash_password(password),
            full_name=full_name.strip(),
            default_framework=default_framework,
        )
        self.db.add(org)
        self.db.add(user)
        await self.db.flush()

        owner_perms = sorted(p.value for p in ROLE_PERMISSIONS["owner"])
        membership = Membership(
            organization_id=org.id,
            user_id=user.id,
            role_key="owner",
            permissions=owner_perms,
        )
        self.db.add(membership)
        await self.db.flush()

        await write_audit(
            self.db,
            organization_id=org.id,
            actor_user_id=user.id,
            action="organization.created",
            resource_type="organization",
            resource_id=str(org.id),
        )
        await self.db.commit()

        tokens = self._issue_tokens(user, org, membership)
        return {
            "organization": {"id": str(org.id), "name": org.name, "slug": org.slug},
            "user": {"id": str(user.id), "email": user.email, "full_name": user.full_name},
            **tokens,
        }

    async def login(self, *, email: str, password: str, organization_id: uuid.UUID | None = None) -> dict:
        result = await self.db.execute(select(User).where(User.email == email.lower()))
        user = result.scalar_one_or_none()
        if user is None or not verify_password(password, user.password_hash):
            raise UnauthorizedError("E-mail ou senha inválidos.")
        if not user.is_active:
            raise UnauthorizedError("Conta desativada.")

        q = select(Membership).where(Membership.user_id == user.id, Membership.is_active.is_(True))
        if organization_id:
            q = q.where(Membership.organization_id == organization_id)
        memberships = (await self.db.execute(q)).scalars().all()
        if not memberships:
            raise UnauthorizedError("Sem organização ativa.")

        membership = memberships[0]
        org = await self.db.get(Organization, membership.organization_id)
        if org is None or not org.is_active:
            raise UnauthorizedError("Organização inativa.")

        user.last_login_at = datetime.now(UTC)
        await write_audit(
            self.db,
            organization_id=org.id,
            actor_user_id=user.id,
            action="auth.login",
            resource_type="user",
            resource_id=str(user.id),
        )
        await self.db.commit()

        tokens = self._issue_tokens(user, org, membership)
        return {
            "organization": {"id": str(org.id), "name": org.name, "slug": org.slug},
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "default_framework": user.default_framework,
            },
            "membership": {
                "id": str(membership.id),
                "role_key": membership.role_key,
                "permissions": membership.permissions,
            },
            **tokens,
        }

    def _issue_tokens(self, user: User, org: Organization, membership: Membership) -> dict:
        access = create_access_token(
            user_id=str(user.id),
            organization_id=str(org.id),
            membership_id=str(membership.id),
            permissions=list(membership.permissions),
        )
        refresh = create_refresh_token(
            user_id=str(user.id),
            organization_id=str(org.id),
            membership_id=str(membership.id),
        )
        return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


def permissions_for_role(role_key: str) -> list[str]:
    perms = ROLE_PERMISSIONS.get(role_key)
    if perms is None:
        raise ValidationAppError(f"Perfil desconhecido: {role_key}")
    return sorted(p.value for p in perms)


def assert_clinical_access(permissions: frozenset[str]) -> None:
    if Permission.CLINICAL_RECORD_READ.value not in permissions:
        raise UnauthorizedError()  # pragma: no cover
