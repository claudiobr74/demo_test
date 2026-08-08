"""Consents + session close + reschedule."""

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
async def test_consent_lifecycle(client: AsyncClient):
    auth = await _auth(client, "consent@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Ana", "last_name": "Lima", "internal_code": "PAC-010"},
    )
    pid = patient.json()["id"]

    templates = await client.get("/api/v1/consents/templates", headers=headers)
    assert templates.status_code == 200
    assert len(templates.json()["items"]) >= 4

    created = await client.post(
        f"/api/v1/consents/patients/{pid}",
        headers=headers,
        json={"consent_type": "ai_processing"},
    )
    assert created.status_code == 201, created.text
    cid = created.json()["id"]
    assert created.json()["status"] == "pending"

    decided = await client.post(
        f"/api/v1/consents/{cid}/decision",
        headers=headers,
        json={"status": "accepted", "method": "manual"},
    )
    assert decided.status_code == 200
    assert decided.json()["status"] == "accepted"
    assert decided.json()["version"]


@pytest.mark.asyncio
async def test_session_autosave_and_close_creates_record(client: AsyncClient):
    auth = await _auth(client, "session@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Bruno", "last_name": "Dias", "internal_code": "PAC-011"},
    )
    pid = patient.json()["id"]

    started = await client.post(
        "/api/v1/sessions/start",
        headers=headers,
        json={"patient_id": pid},
    )
    assert started.status_code == 201, started.text
    sid = started.json()["id"]
    version = started.json()["version"]

    saved = await client.patch(
        f"/api/v1/sessions/{sid}/autosave",
        headers=headers,
        json={"focus": "Ansiedade social", "observations": "Evolução breve", "version": version},
    )
    assert saved.status_code == 200
    assert saved.json()["save_state"] == "saved"

    closed = await client.post(
        f"/api/v1/sessions/{sid}/close",
        headers=headers,
        json={"finalize_record": True},
    )
    assert closed.status_code == 200
    assert closed.json()["status"] == "completed"
    assert closed.json()["clinical_record"]["status"] == "finalized"

    records = await client.get(f"/api/v1/clinical-records/patients/{pid}", headers=headers)
    assert records.status_code == 200
    assert records.json()["items"]


@pytest.mark.asyncio
async def test_appointment_reschedule(client: AsyncClient):
    auth = await _auth(client, "agenda@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Carla", "last_name": "Nunes", "internal_code": "PAC-012"},
    )
    pid = patient.json()["id"]
    starts = datetime.now(UTC) + timedelta(days=1)
    created = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "patient_id": pid,
            "starts_at": starts.isoformat(),
            "duration_minutes": 50,
        },
    )
    assert created.status_code == 201, created.text
    aid = created.json()["id"]
    version = created.json()["version"]

    new_start = starts + timedelta(hours=2)
    rescheduled = await client.post(
        f"/api/v1/appointments/{aid}/reschedule",
        headers=headers,
        json={"starts_at": new_start.isoformat(), "version": version},
    )
    assert rescheduled.status_code == 200, rescheduled.text
    assert rescheduled.json()["status"] == "awaiting_confirmation"
