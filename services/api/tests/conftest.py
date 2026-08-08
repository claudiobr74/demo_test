"""Shared fixtures — isolated test DB."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.permissions import ROLE_PERMISSIONS
from app.core.security import hash_password
from app.infrastructure.db.base import Base
from app.infrastructure.db.models_identity import Membership, Organization, User
from app.infrastructure.db.session import get_db
from app.main import app

TEST_DB = settings.database_url.rsplit("/", 1)[0] + "/serenapsi_test"


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(TEST_DB, pool_pre_ping=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db(engine) -> AsyncIterator[AsyncSession]:
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(engine) -> AsyncIterator[AsyncClient]:
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _override() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def create_org_user(
    db: AsyncSession,
    *,
    email: str,
    role: str = "owner",
    org_name: str | None = None,
) -> tuple[Organization, User, Membership]:
    org = Organization(
        name=org_name or f"Org {uuid.uuid4().hex[:6]}",
        slug=f"org-{uuid.uuid4().hex[:8]}",
        kind="individual",
    )
    user = User(
        email=email,
        password_hash=hash_password("TestPassword1!"),
        full_name="Profissional Teste",
        default_framework="cbt",
    )
    db.add_all([org, user])
    await db.flush()
    membership = Membership(
        organization_id=org.id,
        user_id=user.id,
        role_key=role,
        permissions=sorted(p.value for p in ROLE_PERMISSIONS[role]),
    )
    db.add(membership)
    await db.commit()
    await db.refresh(org)
    await db.refresh(user)
    await db.refresh(membership)
    return org, user, membership
