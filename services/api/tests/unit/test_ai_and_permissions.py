"""Unit tests — privacy, permissions, AI gateway offline path."""

from app.ai_gateway import PrivacyLayer, SafetyEngine, SerenaAIGateway, SupervisorMode
from app.core.permissions import CLINICAL_SENSITIVE, ROLE_PERMISSIONS, Permission


def test_secretary_has_no_clinical_sensitive_permissions():
    secretary = ROLE_PERMISSIONS["secretary"]
    assert CLINICAL_SENSITIVE.isdisjoint(secretary)
    assert Permission.AI_SUPERVISION_USE not in secretary
    assert Permission.CLINICAL_RECORD_READ not in secretary


def test_owner_has_all_permissions():
    assert ROLE_PERMISSIONS["owner"] == frozenset(Permission)


def test_privacy_layer_strips_identifiers():
    layer = PrivacyLayer()
    minimized = layer.minimize(
        {
            "patient_code": "PAC-042",
            "age": 43,
            "cpf": "123.456.789-00",
            "phone": "11999999999",
            "email": "x@y.com",
            "address": {"street": "Rua A"},
            "facts": [{"text": "mudou de emprego"}],
        }
    )
    assert "cpf" not in minimized
    assert "phone" not in minimized
    assert "email" not in minimized
    assert "address" not in minimized
    assert minimized["patient_code"] == "PAC-042"
    assert minimized["facts"][0]["text"] == "mudou de emprego"


def test_safety_engine_flags_risk_without_autonomy():
    alerts = SafetyEngine().scan("Paciente mencionou ideação suicida leve")
    assert alerts
    assert alerts[0]["code"] == "REQUIRES_PROFESSIONAL_ASSESSMENT"


async def test_offline_supervisor_never_blocks_care():
    gw = SerenaAIGateway()
    result = await gw.run_supervisor(
        mode=SupervisorMode.PREPARE_SESSION,
        framework_id="cbt",
        raw_context={
            "patient_code": "PAC-001",
            "suggested_focus": "Revisar tarefas de exposição",
            "facts": ["Iniciou novo emprego"],
            "hypotheses": ["Possível ativação de crença de incompetência"],
        },
    )
    assert result.metadata["provider"] == "none"
    assert "não são verdades absolutas" in result.epistemology_note.lower() or "Sugestões" in result.epistemology_note
    assert result.suggested_focus
