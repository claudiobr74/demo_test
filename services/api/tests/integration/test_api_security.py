"""Integration + security — auth, patients, multitenancy."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_org_user


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": "Clínica Aurora",
            "email": "aurora@example.com",
            "password": "SecurePass12",
            "full_name": "Dra. Aurora",
            "default_framework": "cbt",
        },
    )
    assert reg.status_code == 201, reg.text
    body = reg.json()
    assert "access_token" in body

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "aurora@example.com", "password": "SecurePass12"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["email"] == "aurora@example.com"


@pytest.mark.asyncio
async def test_patient_crud_and_display_name(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": "Clínica Pacientes",
            "email": "pac@example.com",
            "password": "SecurePass12",
            "full_name": "Dra. Pac",
        },
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "João", "last_name": "Silva", "internal_code": "PAC-042"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["display_name"] == "João Silva • PAC-042"

    listed = await client.get("/api/v1/patients", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1


@pytest.mark.asyncio
async def test_cross_tenant_patient_access_denied(
    client: AsyncClient, db: AsyncSession
):
    await create_org_user(db, email="a@tenant.example")
    await create_org_user(db, email="b@tenant.example")

    login_a = await client.post(
        "/api/v1/auth/login",
        json={"email": "a@tenant.example", "password": "TestPassword1!"},
    )
    assert login_a.status_code == 200, login_a.text
    token_a = login_a.json()["access_token"]
    create = await client.post(
        "/api/v1/patients",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"first_name": "Privado", "last_name": "TenantA", "internal_code": "PAC-001"},
    )
    assert create.status_code == 201, create.text
    patient_id = create.json()["id"]

    login_b = await client.post(
        "/api/v1/auth/login",
        json={"email": "b@tenant.example", "password": "TestPassword1!"},
    )
    assert login_b.status_code == 200, login_b.text
    token_b = login_b.json()["access_token"]
    sneak = await client.get(
        f"/api/v1/patients/{patient_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert sneak.status_code == 404


@pytest.mark.asyncio
async def test_secretary_cannot_use_supervisor(client: AsyncClient, db: AsyncSession):
    await create_org_user(db, email="sec@tenant.example", role="secretary")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "sec@tenant.example", "password": "TestPassword1!"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    resp = await client.post(
        "/api/v1/supervisor/run",
        headers={"Authorization": f"Bearer {token}"},
        json={"mode": "prepare_session", "context": {}},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_today_board(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": "Clínica Dia",
            "email": "dia@example.com",
            "password": "SecurePass12",
            "full_name": "Dra. Dia",
        },
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    board = await client.get("/api/v1/today", headers=headers)
    assert board.status_code == 200
    data = board.json()
    assert data["primary_question"] == "O que preciso fazer agora?"
    assert "appointments" in data
    assert "pendencies" in data
