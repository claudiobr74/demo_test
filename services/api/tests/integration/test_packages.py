"""Session packages — create, debit on session close, cancel."""

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
            "full_name": "Dra. Pacotes",
        },
    )
    assert reg.status_code == 201, reg.text
    return reg.json()


@pytest.mark.asyncio
async def test_package_debits_instead_of_charge(client: AsyncClient):
    auth = await _auth(client, "packages@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Ana",
            "last_name": "Pacote",
            "internal_code": "PAC-PKG",
            "session_fee": "180.00",
        },
    )
    assert patient.status_code == 201, patient.text
    pid = patient.json()["id"]

    pkg = await client.post(
        "/api/v1/finance/packages",
        headers=headers,
        json={"patient_id": pid, "total_sessions": 4, "price": "600.00"},
    )
    assert pkg.status_code == 201, pkg.text
    assert pkg.json()["remaining_sessions"] == 4
    assert pkg.json()["charge"]["amount"] == "600.00"

    started = await client.post(
        "/api/v1/sessions/start",
        headers=headers,
        json={"patient_id": pid},
    )
    sid = started.json()["id"]
    version = started.json()["version"]
    await client.patch(
        f"/api/v1/sessions/{sid}/autosave",
        headers=headers,
        json={"focus": "Ansiedade", "observations": "Ok", "version": version},
    )

    closed = await client.post(
        f"/api/v1/sessions/{sid}/close",
        headers=headers,
        json={"finalize_record": True},
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["charge"] is None
    assert closed.json()["package"]["used_sessions"] == 1
    assert closed.json()["package"]["remaining_sessions"] == 3

    listed = await client.get(f"/api/v1/finance/packages?patient_id={pid}", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["items"][0]["used_sessions"] == 1


@pytest.mark.asyncio
async def test_cancel_package(client: AsyncClient):
    auth = await _auth(client, "pkgcancel@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    patient = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={"first_name": "Bia", "last_name": "X", "internal_code": "PAC-CX"},
    )
    pid = patient.json()["id"]
    pkg = await client.post(
        "/api/v1/finance/packages",
        headers=headers,
        json={"patient_id": pid, "total_sessions": 2, "price": "300.00", "create_charge": False},
    )
    pkg_id = pkg.json()["id"]
    cancelled = await client.post(f"/api/v1/finance/packages/{pkg_id}/cancel", headers=headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
