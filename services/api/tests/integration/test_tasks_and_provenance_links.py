"""Tasks API + provenance deep_links."""

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
async def test_task_create_complete_and_today_deep_link(client: AsyncClient):
    auth = await _auth(client, "tasks@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Lia", "last_name": "Nunes", "internal_code": "PAC-070"},
    )
    pid = patient.json()["id"]

    created = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Ligar para responsável",
            "patient_id": pid,
            "kind": "admin",
            "priority": 5,
        },
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    assert created.json()["deep_link"] == f"/pacientes/{pid}"

    listed = await client.get("/api/v1/tasks", headers=headers)
    assert listed.status_code == 200
    assert any(t["id"] == task_id for t in listed.json()["items"])

    today = await client.get("/api/v1/today", headers=headers)
    assert today.status_code == 200
    assert any(t["id"] == task_id for t in today.json()["tasks"])

    done = await client.post(f"/api/v1/tasks/{task_id}/complete", headers=headers)
    assert done.status_code == 200
    assert done.json()["status"] == "done"

    listed2 = await client.get("/api/v1/tasks", headers=headers)
    assert all(t["id"] != task_id for t in listed2.json()["items"])


@pytest.mark.asyncio
async def test_provenance_deep_link_and_session_list(client: AsyncClient):
    auth = await _auth(client, "deeplink@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Nina", "last_name": "Costa", "internal_code": "PAC-071"},
    )
    pid = patient.json()["id"]

    starts = datetime.now(UTC) + timedelta(hours=2)
    appt = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "patient_id": pid,
            "starts_at": starts.isoformat(),
            "duration_minutes": 50,
        },
    )
    assert appt.status_code == 201, appt.text

    session = await client.post(
        "/api/v1/sessions/start",
        headers=headers,
        json={"patient_id": pid, "appointment_id": appt.json()["id"]},
    )
    assert session.status_code == 201, session.text
    sid = session.json()["id"]

    sessions = await client.get(f"/api/v1/sessions?patient_id={pid}", headers=headers)
    assert sessions.status_code == 200
    assert any(s["id"] == sid for s in sessions.json()["items"])

    memory = await client.post(
        f"/api/v1/case-memory/patients/{pid}",
        headers=headers,
        json={
            "kind": "observation",
            "content": "Ansiedade antecipatória",
            "provenance": [
                {"resource_type": "session", "resource_id": sid, "note": "Sessão de hoje"}
            ],
        },
    )
    assert memory.status_code == 201, memory.text
    prov = memory.json()["provenance"][0]
    assert prov["deep_link"] == f"/sessoes/{sid}"

    added = await client.post(
        f"/api/v1/case-memory/{memory.json()['id']}/provenance",
        headers=headers,
        json={"resource_type": "formulation"},
    )
    assert added.status_code == 200
    assert any(
        p.get("deep_link") == f"/pacientes/{pid}/formulacao" for p in added.json()["provenance"]
    )
