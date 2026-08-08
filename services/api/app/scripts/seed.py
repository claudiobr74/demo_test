"""Development seed — fictitious data only. Never use real patient data."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.core.permissions import ROLE_PERMISSIONS
from app.core.security import hash_password
from app.infrastructure.db.models_clinical import Appointment, Patient
from app.infrastructure.db.models_identity import Membership, Organization, User
from app.infrastructure.db.session import AsyncSessionLocal


FIXTURE_PATIENTS = [
    ("Mariana", "Costa"),
    ("Lucas", "Almeida"),
    ("Beatriz", "Oliveira"),
    ("Rafael", "Ferreira"),
    ("Camila", "Santos"),
]


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).where(User.email == "dra.marina@serenapsi.dev"))
        if existing:
            print("Seed already applied.")
            return

        org = Organization(
            name="Consultório Dra. Marina Silva",
            slug="consultorio-marina-dev",
            kind="individual",
            settings={"onboarding_completed": True},
        )
        user = User(
            email="dra.marina@serenapsi.dev",
            password_hash=hash_password("SerenaPsi!dev1"),
            full_name="Marina Silva",
            preferred_name="Marina",
            professional_registration="CRP 06/00000",
            specialty="Psicologia Clínica",
            default_framework="cbt",
        )
        secretary = User(
            email="secretaria@serenapsi.dev",
            password_hash=hash_password("SerenaPsi!dev1"),
            full_name="Ana Secretária",
            default_framework="cbt",
        )
        db.add_all([org, user, secretary])
        await db.flush()

        owner = Membership(
            organization_id=org.id,
            user_id=user.id,
            role_key="owner",
            permissions=sorted(p.value for p in ROLE_PERMISSIONS["owner"]),
        )
        sec = Membership(
            organization_id=org.id,
            user_id=secretary.id,
            role_key="secretary",
            permissions=sorted(p.value for p in ROLE_PERMISSIONS["secretary"]),
        )
        db.add_all([owner, sec])
        await db.flush()

        patients: list[Patient] = []
        for i, (first, last) in enumerate(FIXTURE_PATIENTS, start=1):
            p = Patient(
                organization_id=org.id,
                first_name=first,
                last_name=last,
                internal_code=f"PAC-{i:03d}",
                status="active",
                modality="in_person" if i % 2 else "online",
                session_fee=Decimal("180.00"),
                responsible_professional_id=user.id,
                framework="cbt" if i % 2 else "schema",
            )
            patients.append(p)
        db.add_all(patients)
        await db.flush()

        now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
        for i, p in enumerate(patients[:3]):
            starts = now.replace(hour=9 + i * 2) + timedelta(days=0)
            db.add(
                Appointment(
                    organization_id=org.id,
                    patient_id=p.id,
                    professional_id=user.id,
                    starts_at=starts,
                    ends_at=starts + timedelta(minutes=50),
                    duration_minutes=50,
                    modality=p.modality,
                    status="confirmed" if i == 0 else "awaiting_confirmation",
                    confirmation_status="confirmed" if i == 0 else "pending",
                )
            )

        await db.commit()
        print("Seed OK")
        print("  Login: dra.marina@serenapsi.dev / SerenaPsi!dev1")
        print("  Org:", org.name)


if __name__ == "__main__":
    asyncio.run(seed())
