"""Finance charges/payments + case memory + prepare context + confirmation message."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient


async def _auth(client: AsyncClient, email: str) -> dict:
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "organization_name": f"Clinica {email}",
            "email": email,
            "password": "SecurePass12",
            "full_name": "Dra. Teste",
        },
    )
    assert reg.status_code == 201, reg.text
    return reg.json()


@pytest.mark.asyncio
async def test_session_close_creates_charge_and_payment(client: AsyncClient):
    auth = await _auth(client, "finance@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Lia",
            "last_name": "Souza",
            "internal_code": "PAC-020",
            "session_fee": "180.00",
        },
    )
    assert patient.status_code == 201, patient.text
    pid = patient.json()["id"]

    started = await client.post(
        "/api/v1/sessions/start",
        headers=headers,
        json={"patient_id": pid},
    )
    assert started.status_code == 201, started.text
    sid = started.json()["id"]
    version = started.json()["version"]

    await client.patch(
        f"/api/v1/sessions/{sid}/autosave",
        headers=headers,
        json={"focus": "Sono", "observations": "Evolução", "version": version},
    )

    closed = await client.post(
        f"/api/v1/sessions/{sid}/close",
        headers=headers,
        json={"finalize_record": True},
    )
    assert closed.status_code == 200, closed.text
    charge = closed.json()["charge"]
    assert charge is not None
    assert charge["amount"] == "180.00"
    assert charge["status"] == "pending"

    # Idempotent second close path via ensure — charge already exists on list
    charges = await client.get("/api/v1/finance/charges", headers=headers)
    assert charges.status_code == 200
    items = charges.json()["items"]
    assert len(items) == 1
    charge_id = items[0]["id"]

    summary = await client.get("/api/v1/finance/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["open_charges"] == 1

    paid = await client.post(
        "/api/v1/finance/payments",
        headers=headers,
        json={"charge_id": charge_id, "amount": "180.00", "method": "pix"},
    )
    assert paid.status_code == 201, paid.text
    assert paid.json()["charge"]["status"] == "paid"

    summary2 = await client.get("/api/v1/finance/summary", headers=headers)
    assert summary2.json()["open_charges"] == 0


@pytest.mark.asyncio
async def test_case_memory_and_prepare_context(client: AsyncClient):
    auth = await _auth(client, "memory@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Rafa", "last_name": "Melo", "internal_code": "PAC-021"},
    )
    pid = patient.json()["id"]

    created = await client.post(
        f"/api/v1/case-memory/patients/{pid}",
        headers=headers,
        json={"kind": "fact", "content": "Tem irmão mais novo"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["kind"] == "fact"
    assert created.json()["epistemology"] == "documented_fact"

    hyp = await client.post(
        f"/api/v1/case-memory/patients/{pid}",
        headers=headers,
        json={
            "kind": "hypothesis",
            "content": "Esquema de abandono em ativação",
            "source": "ai_suggestion",
        },
    )
    assert hyp.status_code == 201
    hid = hyp.json()["id"]
    assert hyp.json()["pending_review"] is True

    accepted = await client.post(f"/api/v1/case-memory/{hid}/accept", headers=headers)
    assert accepted.status_code == 200
    assert accepted.json()["pending_review"] is False

    prep = await client.get(f"/api/v1/sessions/prepare/{pid}", headers=headers)
    assert prep.status_code == 200, prep.text
    memory = prep.json()["case_memory"]
    assert len(memory["facts"]) >= 1
    assert len(memory["hypotheses"]) >= 1


@pytest.mark.asyncio
async def test_confirmation_message(client: AsyncClient):
    auth = await _auth(client, "confirm@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Tina", "last_name": "Reis", "internal_code": "PAC-022"},
    )
    pid = patient.json()["id"]
    starts = datetime.now(UTC) + timedelta(days=2)
    created = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={"patient_id": pid, "starts_at": starts.isoformat(), "duration_minutes": 50},
    )
    aid = created.json()["id"]

    msg = await client.get(f"/api/v1/appointments/{aid}/confirmation-message", headers=headers)
    assert msg.status_code == 200, msg.text
    body = msg.json()
    assert "Tina" in body["message"]
    assert body["channel_agnostic"] is True
    assert "whatsapp" in body["suggested_channels"]
