"""Recurrence series + documents scaffold."""

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
async def test_weekly_recurrence_creates_series(client: AsyncClient):
    auth = await _auth(client, "recur@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Eva", "last_name": "Rocha", "internal_code": "PAC-030"},
    )
    pid = patient.json()["id"]
    starts = datetime.now(UTC) + timedelta(days=3)
    created = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "patient_id": pid,
            "starts_at": starts.isoformat(),
            "duration_minutes": 50,
            "recurrence_frequency": "weekly",
            "recurrence_count": 4,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["series_count"] == 4
    assert body["recurrence_id"]
    assert body["recurrence_frequency"] == "weekly"

    end = starts + timedelta(days=30)
    listed = await client.get(
        "/api/v1/appointments",
        headers=headers,
        params={"start": starts.isoformat(), "end": end.isoformat()},
    )
    assert listed.status_code == 200, listed.text
    items = listed.json()["items"]
    series = [i for i in items if i.get("recurrence_id") == body["recurrence_id"]]
    assert len(series) == 4


@pytest.mark.asyncio
async def test_document_from_template(client: AsyncClient):
    auth = await _auth(client, "docs@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Hugo", "last_name": "Pires", "internal_code": "PAC-031"},
    )
    pid = patient.json()["id"]

    templates = await client.get("/api/v1/documents/templates", headers=headers)
    assert templates.status_code == 200, templates.text
    items = templates.json()["items"]
    assert len(items) >= 3
    template_id = items[0]["id"]

    created = await client.post(
        "/api/v1/documents",
        headers=headers,
        json={"patient_id": pid, "template_id": template_id},
    )
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "draft"
    assert "Hugo" in created.json()["body"]
    doc_id = created.json()["id"]

    finalized = await client.post(
        f"/api/v1/documents/{doc_id}/finalize",
        headers=headers,
        json={"confirm": True},
    )
    assert finalized.status_code == 200
    assert finalized.json()["status"] == "finalized"

    listed = await client.get(f"/api/v1/documents?patient_id={pid}", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    for fmt in ("txt", "html", "pdf"):
        exported = await client.get(
            f"/api/v1/documents/{doc_id}/export",
            headers=headers,
            params={"format": fmt},
        )
        assert exported.status_code == 200, exported.text
        payload = exported.json()
        assert payload["content"]
        assert payload["filename"]
        assert "Hugo" in payload["content"] or "html" in payload["media_type"]
        if fmt == "txt":
            assert payload["format"] == "txt"
            assert "text/plain" in payload["media_type"]
        else:
            assert payload["format"] == "html"
            assert "text/html" in payload["media_type"]
            assert payload.get("print_hint")
