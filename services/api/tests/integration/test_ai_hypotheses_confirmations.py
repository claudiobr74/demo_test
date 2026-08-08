"""AI observability, clinical hypotheses, confirmation queue."""

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
async def test_supervisor_persists_observability_and_hypotheses(client: AsyncClient):
    auth = await _auth(client, "aiobs@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Vera", "last_name": "Luz", "internal_code": "PAC-060"},
    )
    pid = patient.json()["id"]

    # Seed a hypothesis-like context via case memory for offline assist
    await client.post(
        f"/api/v1/case-memory/patients/{pid}",
        headers=headers,
        json={"kind": "hypothesis", "content": "Esquema de exclusão em ativação"},
    )

    run = await client.post(
        "/api/v1/supervisor/run",
        headers=headers,
        json={
            "mode": "case_formulation",
            "patient_id": pid,
            "import_hypotheses": True,
        },
    )
    assert run.status_code == 200, run.text
    body = run.json()
    assert "observability" in body
    assert body["observability"]["request_id"]
    assert body["observability"]["output_id"]

    history = await client.get(f"/api/v1/ai/history/patients/{pid}", headers=headers)
    assert history.status_code == 200
    assert len(history.json()["items"]) >= 1

    feedback = await client.post(
        "/api/v1/ai/feedback",
        headers=headers,
        json={"output_id": body["observability"]["output_id"], "useful": True, "reasons": ["generic"]},
    )
    assert feedback.status_code == 200
    assert feedback.json()["useful"] is True

    hyps = await client.get(f"/api/v1/hypotheses/patients/{pid}", headers=headers)
    assert hyps.status_code == 200
    # offline assist may import from case memory hypotheses
    assert isinstance(hyps.json()["items"], list)

    usage = await client.get("/api/v1/ai/usage?days=30", headers=headers)
    assert usage.status_code == 200, usage.text
    panel = usage.json()
    assert panel["total_requests"] >= 1
    assert "avg_latency_ms" in panel
    assert "estimated_cost_usd" in panel
    assert "by_provider" in panel
    assert "by_task" in panel
    assert "feedback" in panel


@pytest.mark.asyncio
async def test_clinical_hypothesis_lifecycle(client: AsyncClient):
    auth = await _auth(client, "hyps@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Ivo", "last_name": "Reis", "internal_code": "PAC-061"},
    )
    pid = patient.json()["id"]

    form = await client.put(
        f"/api/v1/formulations/patients/{pid}/draft",
        headers=headers,
        json={"body": {"therapeutic_focus": "Exposição"}},
    )
    fid = form.json()["id"]

    created = await client.post(
        f"/api/v1/hypotheses/patients/{pid}",
        headers=headers,
        json={
            "statement": "Crença de incompetência sustenta evitamento",
            "formulation_id": fid,
            "epistemology": "working_hypothesis",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["formulation_id"] == fid
    hid = created.json()["id"]

    strengthened = await client.post(
        f"/api/v1/hypotheses/{hid}/strength",
        headers=headers,
        json={"strength": "strengthened"},
    )
    assert strengthened.status_code == 200
    assert strengthened.json()["strength"] == "strengthened"


@pytest.mark.asyncio
async def test_confirmation_queue(client: AsyncClient):
    auth = await _auth(client, "confirmq@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Lara", "last_name": "Mota", "internal_code": "PAC-062"},
    )
    pid = patient.json()["id"]
    starts = datetime.now(UTC) + timedelta(days=2)
    appt = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={"patient_id": pid, "starts_at": starts.isoformat(), "duration_minutes": 50},
    )
    aid = appt.json()["id"]

    queued = await client.post(
        f"/api/v1/confirmations/appointments/{aid}/enqueue",
        headers=headers,
        json={"channel": "whatsapp"},
    )
    assert queued.status_code == 201, queued.text
    assert queued.json()["status"] == "queued"
    assert queued.json()["delivery"] == "stub"
    assert "Lara" in queued.json()["message"]

    q = await client.get("/api/v1/confirmations/queue", headers=headers)
    assert q.status_code == 200
    assert len(q.json()["items"]) >= 1
    nid = q.json()["items"][0]["id"]

    copied = await client.post(
        f"/api/v1/confirmations/queue/{nid}/status",
        headers=headers,
        json={"status": "copied"},
    )
    assert copied.status_code == 200, copied.text
    assert copied.json()["status"] == "copied"

    sent = await client.post(
        f"/api/v1/confirmations/queue/{nid}/status",
        headers=headers,
        json={"status": "sent"},
    )
    assert sent.status_code == 200
    assert sent.json()["status"] == "sent"
    assert sent.json()["delivery"] == "manual_sent"

    appt_after = await client.get(f"/api/v1/appointments/{aid}", headers=headers)
    assert appt_after.status_code == 200
    assert appt_after.json().get("confirmation_status") == "sent"

    confirmed = await client.post(
        f"/api/v1/confirmations/queue/{nid}/status",
        headers=headers,
        json={"status": "patient_confirmed"},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "patient_confirmed"

    appt_confirmed = await client.get(f"/api/v1/appointments/{aid}", headers=headers)
    assert appt_confirmed.status_code == 200
    assert appt_confirmed.json()["status"] == "confirmed"
    assert appt_confirmed.json()["confirmation_status"] == "confirmed"
