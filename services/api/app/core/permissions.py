"""Permission catalog — authorization is permission-based, never role-name-only."""

from __future__ import annotations

from enum import StrEnum


class Permission(StrEnum):
    PATIENT_READ = "patient.read"
    PATIENT_WRITE = "patient.write"

    APPOINTMENT_READ = "appointment.read"
    APPOINTMENT_WRITE = "appointment.write"

    SESSION_READ = "session.read"
    SESSION_WRITE = "session.write"

    CLINICAL_RECORD_READ = "clinical_record.read"
    CLINICAL_RECORD_WRITE = "clinical_record.write"

    TRANSCRIPT_READ = "transcript.read"
    TRANSCRIPT_WRITE = "transcript.write"

    FINANCE_READ = "finance.read"
    FINANCE_WRITE = "finance.write"

    DOCUMENT_READ = "document.read"
    DOCUMENT_WRITE = "document.write"

    CONSENT_READ = "consent.read"
    CONSENT_WRITE = "consent.write"

    AI_SUPERVISION_USE = "ai_supervision.use"

    TASK_READ = "task.read"
    TASK_WRITE = "task.write"

    ORGANIZATION_MANAGE = "organization.manage"
    AUDIT_READ = "audit.read"
    MEMBER_MANAGE = "member.manage"


# Role templates — actual authorization always checks Permission set on membership.
ROLE_PERMISSIONS: dict[str, frozenset[Permission]] = {
    "owner": frozenset(Permission),
    "psychologist": frozenset(
        {
            Permission.PATIENT_READ,
            Permission.PATIENT_WRITE,
            Permission.APPOINTMENT_READ,
            Permission.APPOINTMENT_WRITE,
            Permission.SESSION_READ,
            Permission.SESSION_WRITE,
            Permission.CLINICAL_RECORD_READ,
            Permission.CLINICAL_RECORD_WRITE,
            Permission.TRANSCRIPT_READ,
            Permission.TRANSCRIPT_WRITE,
            Permission.FINANCE_READ,
            Permission.FINANCE_WRITE,
            Permission.DOCUMENT_READ,
            Permission.DOCUMENT_WRITE,
            Permission.CONSENT_READ,
            Permission.CONSENT_WRITE,
            Permission.AI_SUPERVISION_USE,
            Permission.TASK_READ,
            Permission.TASK_WRITE,
        }
    ),
    "secretary": frozenset(
        {
            Permission.PATIENT_READ,
            Permission.PATIENT_WRITE,  # administrative fields only — enforced in services
            Permission.APPOINTMENT_READ,
            Permission.APPOINTMENT_WRITE,
            Permission.FINANCE_READ,
            Permission.FINANCE_WRITE,
            Permission.DOCUMENT_READ,
            Permission.CONSENT_READ,
            Permission.CONSENT_WRITE,
            Permission.TASK_READ,
            Permission.TASK_WRITE,
        }
    ),
    "org_admin": frozenset(
        {
            Permission.PATIENT_READ,
            Permission.APPOINTMENT_READ,
            Permission.APPOINTMENT_WRITE,
            Permission.FINANCE_READ,
            Permission.FINANCE_WRITE,
            Permission.DOCUMENT_READ,
            Permission.DOCUMENT_WRITE,
            Permission.CONSENT_READ,
            Permission.ORGANIZATION_MANAGE,
            Permission.AUDIT_READ,
            Permission.MEMBER_MANAGE,
            Permission.TASK_READ,
            Permission.TASK_WRITE,
        }
    ),
}


# Clinical permissions that secretaries must never receive by default.
CLINICAL_SENSITIVE: frozenset[Permission] = frozenset(
    {
        Permission.CLINICAL_RECORD_READ,
        Permission.CLINICAL_RECORD_WRITE,
        Permission.TRANSCRIPT_READ,
        Permission.TRANSCRIPT_WRITE,
        Permission.AI_SUPERVISION_USE,
        Permission.SESSION_READ,
        Permission.SESSION_WRITE,
    }
)
