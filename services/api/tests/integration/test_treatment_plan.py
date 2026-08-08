"""Treatment plan + goals."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.ai_gateway.providers import GeminiProvider, OpenAIProvider, resolve_provider
from app.core.errors import AppError


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
async def test_treatment_plan_and_goals(client: AsyncClient):
    auth = await _auth(client, "plan@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Paula", "last_name": "Neri", "internal_code": "PAC-050"},
    )
    pid = patient.json()["id"]

    empty = await client.get(f"/api/v1/treatment-plans/patients/{pid}/current", headers=headers)
    assert empty.status_code == 200
    assert empty.json()["plan"] is None

    plan = await client.put(
        f"/api/v1/treatment-plans/patients/{pid}",
        headers=headers,
        json={
            "priority_problems": ["Ansiedade social", "Evitação de reuniões"],
            "initial_formulation_summary": "Foco em exposição gradual",
        },
    )
    assert plan.status_code == 200, plan.text
    assert plan.json()["status"] == "active"
    assert len(plan.json()["priority_problems"]) == 2

    goal = await client.post(
        f"/api/v1/treatment-plans/patients/{pid}/goals",
        headers=headers,
        json={"title": "Participar de 1 reunião por semana"},
    )
    assert goal.status_code == 201, goal.text
    gid = goal.json()["id"]

    updated = await client.patch(
        f"/api/v1/treatment-plans/goals/{gid}",
        headers=headers,
        json={"status": "achieved"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "achieved"

    prep = await client.get(f"/api/v1/sessions/prepare/{pid}", headers=headers)
    assert prep.status_code == 200
    # achieved goals excluded from active_goals
    assert prep.json()["active_goals"] == []

    await client.post(
        f"/api/v1/treatment-plans/patients/{pid}/goals",
        headers=headers,
        json={"title": "Praticar respiração diária"},
    )
    prep2 = await client.get(f"/api/v1/sessions/prepare/{pid}", headers=headers)
    assert any(g["title"] == "Praticar respiração diária" for g in prep2.json()["active_goals"])


def test_resolve_provider_routing():
    assert isinstance(resolve_provider("openai"), OpenAIProvider)
    assert isinstance(resolve_provider("gemini"), GeminiProvider)
    try:
        resolve_provider("unknown")
        assert False, "should raise"
    except AppError as exc:
        assert exc.code == "AI_PROVIDER_NOT_CONFIGURED"
