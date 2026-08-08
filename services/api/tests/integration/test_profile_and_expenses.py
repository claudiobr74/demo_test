"""Profile (auth/me) + finance expenses endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


async def _auth(client: AsyncClient, email: str) -> dict:
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": f"Clinica {email}",
            "email": email,
            "password": "SecurePass12",
            "full_name": "Dra. Perfil",
        },
    )
    assert reg.status_code == 201, reg.text
    return reg.json()


@pytest.mark.asyncio
async def test_profile_get_and_update(client: AsyncClient):
    auth = await _auth(client, "profile@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    body = me.json()
    assert body["user"]["email"] == "profile@example.com"
    assert body["organization"]["name"].startswith("Clinica")

    updated = await client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={
            "full_name": "Dra. Marina Atualizada",
            "preferred_name": "Marina",
            "professional_registration": "CRP 06/12345",
            "specialty": "TCC",
            "organization_name": "Consultório Serena",
            "pix_key": "marina@pix.dev",
            "monthly_goal": "12000.00",
        },
    )
    assert updated.status_code == 200, updated.text
    data = updated.json()
    assert data["user"]["full_name"] == "Dra. Marina Atualizada"
    assert data["user"]["preferred_name"] == "Marina"
    assert data["user"]["professional_registration"] == "CRP 06/12345"
    assert data["organization"]["name"] == "Consultório Serena"
    assert data["organization"]["settings"]["pix_key"] == "marina@pix.dev"
    assert data["organization"]["settings"]["monthly_goal"] == "12000.00"


@pytest.mark.asyncio
async def test_expenses_crud_and_summary(client: AsyncClient):
    auth = await _auth(client, "expenses@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    created = await client.post(
        "/api/v1/finance/expenses",
        headers=headers,
        json={
            "category": "Aluguel & Infraestrutura",
            "amount": "1500.00",
            "vendor": "Imobiliária",
            "notes": "Sala 2",
        },
    )
    assert created.status_code == 201, created.text
    expense_id = created.json()["id"]
    assert created.json()["status"] == "pending"

    listed = await client.get("/api/v1/finance/expenses", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    paid = await client.patch(
        f"/api/v1/finance/expenses/{expense_id}",
        headers=headers,
        json={"mark_paid": True},
    )
    assert paid.status_code == 200, paid.text
    assert paid.json()["status"] == "paid"
    assert paid.json()["paid_at"] is not None

    summary = await client.get("/api/v1/finance/summary", headers=headers)
    assert summary.status_code == 200
    body = summary.json()
    assert "expenses_month_amount" in body
    assert "net_month_estimate" in body
    assert body["expenses_paid_month_amount"] == "1500.00"

    cancelled = await client.patch(
        f"/api/v1/finance/expenses/{expense_id}",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
