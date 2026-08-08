"""Living formulation + enriched provenance."""

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
            "full_name": "Dra. Teste",
        },
    )
    assert reg.status_code == 201, reg.text
    return reg.json()


@pytest.mark.asyncio
async def test_living_formulation_lifecycle(client: AsyncClient):
    auth = await _auth(client, "formulation@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Nina", "last_name": "Vale", "internal_code": "PAC-040", "framework": "cbt"},
    )
    pid = patient.json()["id"]

    empty = await client.get(f"/api/v1/formulations/patients/{pid}/current", headers=headers)
    assert empty.status_code == 200
    assert empty.json()["formulation"] is None

    draft = await client.put(
        f"/api/v1/formulations/patients/{pid}/draft",
        headers=headers,
        json={
            "framework": "cbt",
            "body": {
                "therapeutic_focus": "Exposição gradual",
                "presenting_problems": ["Ansiedade social"],
                "working_hypotheses": [
                    {"text": "Crença de inadequação", "epistemology": "working_hypothesis"}
                ],
            },
        },
    )
    assert draft.status_code == 200, draft.text
    fid = draft.json()["id"]
    assert draft.json()["status"] == "draft"
    assert draft.json()["body"]["therapeutic_focus"] == "Exposição gradual"

    promoted = await client.post(f"/api/v1/formulations/{fid}/promote", headers=headers)
    assert promoted.status_code == 200
    assert promoted.json()["is_official"] is True
    assert promoted.json()["status"] == "official"

    prep = await client.get(f"/api/v1/sessions/prepare/{pid}", headers=headers)
    assert prep.status_code == 200
    assert prep.json()["formulation"]["therapeutic_focus"] == "Exposição gradual"
    assert prep.json()["suggested_focus"] == "Exposição gradual"


@pytest.mark.asyncio
async def test_case_memory_provenance(client: AsyncClient):
    auth = await _auth(client, "prov@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Otto", "last_name": "Luz", "internal_code": "PAC-041"},
    )
    pid = patient.json()["id"]

    created = await client.post(
        f"/api/v1/case-memory/patients/{pid}",
        headers=headers,
        json={
            "kind": "observation",
            "content": "Evita reuniões",
            "provenance": [
                {"resource_type": "session", "resource_id": "00000000-0000-0000-0000-000000000001", "note": "Sessão 3"}
            ],
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["provenance"][0]["resource_type"] == "session"
    eid = created.json()["id"]

    added = await client.post(
        f"/api/v1/case-memory/{eid}/provenance",
        headers=headers,
        json={"resource_type": "formulation", "note": "Alinhado à formulação oficial"},
    )
    assert added.status_code == 200
    assert len(added.json()["provenance"]) == 2

    bad = await client.post(
        f"/api/v1/case-memory/{eid}/provenance",
        headers=headers,
        json={"resource_type": "invalid_type"},
    )
    assert bad.status_code == 422
