"""Import all models for Alembic metadata discovery."""

from app.infrastructure.db.models_clinical import (  # noqa: F401
    Appointment,
    AppointmentRecurrence,
    CaseFormulation,
    ClinicalHypothesis,
    ClinicalRecord,
    ClinicalSession,
    Consent,
    ConsentTemplate,
    Patient,
    Task,
    TreatmentGoal,
    TreatmentPlan,
)
from app.infrastructure.db.models_identity import (  # noqa: F401
    AuditEvent,
    FeatureFlag,
    Membership,
    Organization,
    User,
)
from app.infrastructure.db.models_memory import CaseMemoryEntry  # noqa: F401
from app.infrastructure.db.models_ops import (  # noqa: F401
    AiFeedback,
    AiOutput,
    AiRequest,
    Charge,
    Document,
    DocumentTemplate,
    Expense,
    Notification,
    Package,
    PackageUsage,
    Payment,
    Plan,
    Subscription,
)

__all__ = [
    "Organization",
    "User",
    "Membership",
    "AuditEvent",
    "Patient",
    "Consent",
    "Appointment",
    "ClinicalSession",
    "ClinicalRecord",
    "CaseFormulation",
    "TreatmentPlan",
    "Task",
    "Charge",
    "Payment",
    "AiRequest",
    "AiOutput",
    "CaseMemoryEntry",
]
