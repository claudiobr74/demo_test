"""Recording/transcription → revisable CFP proposal (never auto-finalizes record)."""

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


async def _patient_and_session(client: AsyncClient, headers: dict) -> tuple[str, str]:
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Lia", "last_name": "Costa", "internal_code": "PAC-TR"},
    )
    assert patient.status_code == 201, patient.text
    pid = patient.json()["id"]
    started = await client.post(
        "/api/v1/sessions/start",
        headers=headers,
        json={"patient_id": pid},
    )
    assert started.status_code == 201, started.text
    return pid, started.json()["id"]


@pytest.mark.asyncio
async def test_consent_check_fail_closed(client: AsyncClient):
    auth = await _auth(client, "tr-check@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    pid, _ = await _patient_and_session(client, headers)

    check = await client.get(
        f"/api/v1/consents/patients/{pid}/check",
        headers=headers,
        params={"type": "transcription"},
    )
    assert check.status_code == 200
    body = check.json()
    assert body["allowed"] is False
    assert body["consent_type"] == "transcription"


@pytest.mark.asyncio
async def test_propose_blocked_without_transcription_consent(client: AsyncClient):
    auth = await _auth(client, "tr-block@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    _, sid = await _patient_and_session(client, headers)

    proposed = await client.post(
        f"/api/v1/sessions/{sid}/transcription/propose",
        headers=headers,
        json={"transcript_text": "Paciente relatou ansiedade no trabalho."},
    )
    assert proposed.status_code == 403
    assert proposed.json()["code"] == "CONSENT_REQUIRED"


@pytest.mark.asyncio
async def test_propose_and_apply_cfp_does_not_finalize_record(client: AsyncClient):
    auth = await _auth(client, "tr-apply@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    pid, sid = await _patient_and_session(client, headers)

    # Ensure templates exist, then accept transcription consent
    await client.get("/api/v1/consents/templates", headers=headers)
    created = await client.post(
        f"/api/v1/consents/patients/{pid}",
        headers=headers,
        json={"consent_type": "transcription"},
    )
    assert created.status_code == 201, created.text
    decided = await client.post(
        f"/api/v1/consents/{created.json()['id']}/decision",
        headers=headers,
        json={"status": "accepted", "method": "manual"},
    )
    assert decided.status_code == 200

    check = await client.get(
        f"/api/v1/consents/patients/{pid}/check",
        headers=headers,
        params={"type": "transcription"},
    )
    assert check.json()["allowed"] is True

    proposed = await client.post(
        f"/api/v1/sessions/{sid}/transcription/propose",
        headers=headers,
        json={
            "transcript_text": (
                "Paciente descreveu tensão no trabalho e evitação social. "
                "Combinamos exposição gradual e registro de pensamentos."
            )
        },
    )
    assert proposed.status_code == 200, proposed.text
    data = proposed.json()
    assert data["applied_to_record"] is False
    assert data["proposal"]["status"] == "pending_review"
    assert data["proposal"]["focus"]
    assert data["proposal"]["evolution"]
    assert "transcript" in data
    version = data["version"]

    applied = await client.post(
        f"/api/v1/sessions/{sid}/transcription/apply",
        headers=headers,
        json={
            "focus": data["proposal"]["focus"],
            "evolution": "Evolução revisada pela profissional.",
            "relevant_observations": data["proposal"]["relevant_observations"],
            "interventions": data["proposal"]["interventions"],
            "tasks": "Registro de pensamentos diário",
            "planning": data["proposal"]["planning"],
            "agreements": data["proposal"]["agreements"],
            "version": version,
        },
    )
    assert applied.status_code == 200, applied.text
    session = applied.json()
    assert session["applied_to_record"] is False
    assert session["observations"] == "Evolução revisada pela profissional."
    assert session["tasks"] == "Registro de pensamentos diário"
    assert session["structured_data"]["cfp_proposal"]["status"] == "accepted"

    # Clinical record still absent until guided close
    records = await client.get(f"/api/v1/clinical-records/patients/{pid}", headers=headers)
    assert records.status_code == 200
    assert records.json()["items"] == []


@pytest.mark.asyncio
async def test_audio_propose_uses_offline_stt_without_ai(client: AsyncClient):
    auth = await _auth(client, "tr-stt@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    pid, sid = await _patient_and_session(client, headers)
    await client.get("/api/v1/consents/templates", headers=headers)
    created = await client.post(
        f"/api/v1/consents/patients/{pid}",
        headers=headers,
        json={"consent_type": "transcription"},
    )
    await client.post(
        f"/api/v1/consents/{created.json()['id']}/decision",
        headers=headers,
        json={"status": "accepted", "method": "manual"},
    )

    # Tiny fake webm-ish payload — without AI keys STT falls back offline
    import base64

    audio_b64 = base64.b64encode(b"0" * 64).decode("ascii")
    proposed = await client.post(
        f"/api/v1/sessions/{sid}/transcription/propose",
        headers=headers,
        json={"audio_base64": audio_b64, "mime_type": "audio/webm"},
    )
    assert proposed.status_code == 200, proposed.text
    body = proposed.json()
    assert body["stt"]["mode"] == "offline_assist"
    assert "Transcrição offline" in body["transcript"]
    assert body["applied_to_record"] is False
