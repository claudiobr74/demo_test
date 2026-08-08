"""Serena AI Gateway — features never call providers directly.

Architecture:
  Features → Gateway → Privacy → Context Builder → Framework → Model Router → Providers
                      → Clinical Critic → Safety → Structured Output
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Protocol

from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import get_logger

logger = get_logger(__name__)

ENGINE_VERSION = "0.1.0"


class ModelClass(StrEnum):
    FAST = "fast"
    REASONING = "reasoning"
    DEEP_REASONING = "deep_reasoning"


class SupervisorMode(StrEnum):
    PREPARE_SESSION = "prepare_session"
    POST_SESSION_DEBRIEF = "post_session_debrief"
    CASE_FORMULATION = "case_formulation"
    LONGITUDINAL_REVIEW = "longitudinal_review"
    STUCK_CASE = "stuck_case"
    TREATMENT_PLANNING = "treatment_planning"
    CLINICAL_CHAT = "clinical_chat"
    REVIEW_MY_CONDUCT = "review_my_conduct"


class Epistemology(StrEnum):
    DOCUMENTED_FACT = "documented_fact"
    CLINICAL_OBSERVATION = "clinical_observation"
    INFERENCE = "inference"
    WORKING_HYPOTHESIS = "working_hypothesis"
    INSUFFICIENT_INFORMATION = "insufficient_information"


MODE_MODEL_CLASS: dict[SupervisorMode, ModelClass] = {
    SupervisorMode.PREPARE_SESSION: ModelClass.REASONING,
    SupervisorMode.POST_SESSION_DEBRIEF: ModelClass.REASONING,
    SupervisorMode.CASE_FORMULATION: ModelClass.REASONING,
    SupervisorMode.LONGITUDINAL_REVIEW: ModelClass.DEEP_REASONING,
    SupervisorMode.STUCK_CASE: ModelClass.DEEP_REASONING,
    SupervisorMode.TREATMENT_PLANNING: ModelClass.REASONING,
    SupervisorMode.CLINICAL_CHAT: ModelClass.REASONING,
    SupervisorMode.REVIEW_MY_CONDUCT: ModelClass.REASONING,
}


@dataclass
class ModelSpec:
    provider: str
    model: str
    model_class: ModelClass
    supports_structured_output: bool = True
    max_context: int = 128_000


@dataclass
class StructuredSupervisorResult:
    summary: dict[str, Any] = field(default_factory=dict)
    facts: list[dict[str, Any]] = field(default_factory=list)
    observations: list[dict[str, Any]] = field(default_factory=list)
    hypotheses: list[dict[str, Any]] = field(default_factory=list)
    supporting_evidence: list[dict[str, Any]] = field(default_factory=list)
    contrary_evidence: list[dict[str, Any]] = field(default_factory=list)
    alternatives: list[dict[str, Any]] = field(default_factory=list)
    missing_information: list[str] = field(default_factory=list)
    suggested_focus: list[str] = field(default_factory=list)
    questions: list[str] = field(default_factory=list)
    interventions: list[dict[str, Any]] = field(default_factory=list)
    tasks: list[str] = field(default_factory=list)
    alerts: list[dict[str, Any]] = field(default_factory=list)
    epistemology_note: str = (
        "Sugestões do Supervisor. Não são verdades absolutas. "
        "A profissional revisa e decide."
    )
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": self.summary,
            "facts": self.facts,
            "observations": self.observations,
            "hypotheses": self.hypotheses,
            "supporting_evidence": self.supporting_evidence,
            "contrary_evidence": self.contrary_evidence,
            "alternatives": self.alternatives,
            "missing_information": self.missing_information,
            "suggested_focus": self.suggested_focus,
            "questions": self.questions,
            "interventions": self.interventions,
            "tasks": self.tasks,
            "alerts": self.alerts,
            "epistemology_note": self.epistemology_note,
            "metadata": self.metadata,
        }


class LLMProvider(Protocol):
    async def complete(
        self, *, system: str, user: str, model: str, temperature: float = 0.2
    ) -> dict[str, Any]: ...


class ModelRegistry:
    def __init__(self) -> None:
        self._models: dict[ModelClass, ModelSpec] = {}
        self.reload_from_settings()

    def reload_from_settings(self) -> None:
        self._models = {
            ModelClass.FAST: self._parse(settings.ai_fast_model, ModelClass.FAST),
            ModelClass.REASONING: self._parse(settings.ai_reasoning_model, ModelClass.REASONING),
            ModelClass.DEEP_REASONING: self._parse(
                settings.ai_deep_reasoning_model, ModelClass.DEEP_REASONING
            ),
        }

    def _parse(self, value: str, model_class: ModelClass) -> ModelSpec:
        if ":" in value:
            provider, model = value.split(":", 1)
        else:
            provider, model = settings.ai_default_provider, value
        return ModelSpec(provider=provider, model=model, model_class=model_class)

    def resolve(self, model_class: ModelClass) -> ModelSpec:
        return self._models[model_class]


class PrivacyLayer:
    """Minimize identifiers before any LLM call."""

    IDENTIFIER_KEYS = frozenset(
        {"cpf", "phone", "email", "address", "full_address", "rg", "document"}
    )

    def minimize(self, context: dict[str, Any]) -> dict[str, Any]:
        return self._walk(context)

    def _walk(self, node: Any) -> Any:
        if isinstance(node, dict):
            out = {}
            for k, v in node.items():
                if k.lower() in self.IDENTIFIER_KEYS:
                    continue
                out[k] = self._walk(v)
            return out
        if isinstance(node, list):
            return [self._walk(i) for i in node]
        return node


class ContextBuilder:
    """Select only necessary clinical context per supervisor mode + token budget."""

    TOKEN_BUDGETS = {
        SupervisorMode.PREPARE_SESSION: 6_000,
        SupervisorMode.LONGITUDINAL_REVIEW: 16_000,
        SupervisorMode.STUCK_CASE: 12_000,
    }

    def build(self, mode: SupervisorMode, raw_context: dict[str, Any]) -> dict[str, Any]:
        budget = self.TOKEN_BUDGETS.get(mode, 8_000)
        # Prefer structured case memory over raw session dumps.
        selected = {
            "mode": mode.value,
            "patient_code": raw_context.get("patient_code"),
            "framework": raw_context.get("framework"),
            "formulation": raw_context.get("formulation"),
            "active_goals": raw_context.get("active_goals", [])[:10],
            "recent_facts": raw_context.get("facts", [])[:20],
            "recent_observations": raw_context.get("observations", [])[:20],
            "active_hypotheses": raw_context.get("hypotheses", [])[:15],
            "token_budget": budget,
        }
        if mode == SupervisorMode.PREPARE_SESSION:
            selected["last_sessions"] = raw_context.get("last_sessions", [])[:3]
            selected["tasks"] = raw_context.get("tasks", [])[:10]
            selected["suggested_focus"] = raw_context.get("suggested_focus")
        elif mode == SupervisorMode.LONGITUDINAL_REVIEW:
            selected["timeline"] = raw_context.get("timeline", [])[:40]
            selected["patterns"] = raw_context.get("patterns", [])
        return selected


class ClinicalCritic:
    def review(self, result: StructuredSupervisorResult, framework: str) -> StructuredSupervisorResult:
        notes: list[str] = []
        for h in result.hypotheses:
            epi = h.get("epistemology", Epistemology.WORKING_HYPOTHESIS.value)
            if epi == Epistemology.DOCUMENTED_FACT.value and not h.get("evidence_ids"):
                h["epistemology"] = Epistemology.WORKING_HYPOTHESIS.value
                notes.append("Hipótese rebaixada: evidência insuficiente para fato documentado.")
            if not h.get("alternatives_considered"):
                notes.append("Considere hipóteses alternativas antes de fechar formulação.")
        if not result.missing_information:
            notes.append("Verifique lacunas de informação antes de planejar intervenções.")
        result.critic_notes = notes  # type: ignore[attr-defined]
        result.metadata["critic_notes"] = notes
        result.metadata["framework"] = framework
        return result


class SafetyEngine:
    RISK_KEYWORDS = (
        "suicid",
        "automutil",
        "abuso",
        "violência",
        "violencia",
        "psicose",
        "mania",
    )

    def scan(self, text: str) -> list[dict[str, Any]]:
        lowered = text.lower()
        alerts = []
        for kw in self.RISK_KEYWORDS:
            if kw in lowered:
                alerts.append(
                    {
                        "code": "REQUIRES_PROFESSIONAL_ASSESSMENT",
                        "keyword_family": kw,
                        "message": "Requer avaliação profissional. O Supervisor não toma decisões.",
                        "severity": "insufficient_without_clinical_review",
                    }
                )
        return alerts


class ClinicalFrameworkLoader:
    def __init__(self) -> None:
        self._frameworks = {
            "cbt": {
                "id": "cbt",
                "version": "1.0.0",
                "name": "Terapia Cognitivo-Comportamental",
                "cycle": [
                    "situation",
                    "thought",
                    "emotion",
                    "behavior",
                    "consequence",
                    "maintenance",
                ],
                "constructs": [
                    "automatic_thoughts",
                    "intermediate_beliefs",
                    "core_beliefs",
                    "emotions",
                    "behaviors",
                    "physiology",
                ],
            },
            "schema": {
                "id": "schema",
                "version": "1.0.0",
                "name": "Terapia do Esquema",
                "cycle": [
                    "situation",
                    "need",
                    "schema",
                    "mode",
                    "coping",
                    "consequence",
                    "maintenance",
                ],
                "constructs": [
                    "emotional_needs",
                    "schemas",
                    "modes",
                    "coping_styles",
                    "limited_reparenting",
                ],
            },
        }

    def get(self, framework_id: str) -> dict[str, Any]:
        fw = self._frameworks.get(framework_id)
        if not fw:
            return self._frameworks["cbt"]
        return fw

    def list_ids(self) -> list[str]:
        return list(self._frameworks.keys())


class SerenaAIGateway:
    def __init__(self) -> None:
        self.registry = ModelRegistry()
        self.privacy = PrivacyLayer()
        self.context_builder = ContextBuilder()
        self.critic = ClinicalCritic()
        self.safety = SafetyEngine()
        self.frameworks = ClinicalFrameworkLoader()

    async def run_supervisor(
        self,
        *,
        mode: SupervisorMode,
        framework_id: str,
        raw_context: dict[str, Any],
        user_message: str | None = None,
    ) -> StructuredSupervisorResult:
        if not settings.ai_enabled:
            # Product must remain usable without LLM availability.
            return self._offline_assist(mode, framework_id, raw_context, user_message)

        model_class = MODE_MODEL_CLASS[mode]
        spec = self.registry.resolve(model_class)
        minimized = self.privacy.minimize(raw_context)
        context = self.context_builder.build(mode, minimized)
        framework = self.frameworks.get(framework_id)

        # Provider call is intentionally stubbed until keys/config exist.
        # Real providers plug in via LLMProvider protocol without feature coupling.
        _ = (spec, context, framework, user_message)
        raise AppError(
            "AI_PROVIDER_NOT_CONFIGURED",
            "O Supervisor está temporariamente indisponível.",
            status_code=503,
        )

    def _offline_assist(
        self,
        mode: SupervisorMode,
        framework_id: str,
        raw_context: dict[str, Any],
        user_message: str | None,
    ) -> StructuredSupervisorResult:
        framework = self.frameworks.get(framework_id)
        text_blob = " ".join(
            [
                user_message or "",
                str(raw_context.get("last_session_summary") or ""),
                str(raw_context.get("suggested_focus") or ""),
            ]
        )
        alerts = self.safety.scan(text_blob)
        result = StructuredSupervisorResult(
            summary={
                "mode": mode.value,
                "status": "offline_assist",
                "message": (
                    "O Supervisor está em modo assistivo local (IA desabilitada ou indisponível). "
                    "Use as pistas estruturadas abaixo; o atendimento não depende do LLM."
                ),
            },
            facts=[
                {
                    "text": f,
                    "epistemology": Epistemology.DOCUMENTED_FACT.value,
                }
                for f in (raw_context.get("facts") or [])[:5]
            ],
            observations=[
                {
                    "text": o,
                    "epistemology": Epistemology.CLINICAL_OBSERVATION.value,
                }
                for o in (raw_context.get("observations") or [])[:5]
            ],
            hypotheses=[
                {
                    "text": h if isinstance(h, str) else h.get("statement", ""),
                    "epistemology": Epistemology.WORKING_HYPOTHESIS.value,
                    "evidence_ids": [],
                    "alternatives_considered": False,
                }
                for h in (raw_context.get("hypotheses") or [])[:5]
            ],
            missing_information=[
                "Confirme objetivos ativos com a paciente",
                "Verifique tarefas terapêuticas pendentes",
            ],
            suggested_focus=[
                raw_context.get("suggested_focus")
                or "Revisar foco da última sessão e combinados em aberto"
            ],
            questions=[
                "O que mudou desde o último encontro?",
                "Quais evidências sustentam a hipótese atual — e quais a enfraquecem?",
            ],
            alerts=alerts,
            metadata={
                "engine_version": ENGINE_VERSION,
                "framework_version": framework["version"],
                "framework": framework["id"],
                "prompt_policy_version": "offline-1",
                "provider": "none",
                "model": "offline_assist",
                "model_class": MODE_MODEL_CLASS[mode].value,
            },
        )
        return self.critic.review(result, framework["id"])


gateway = SerenaAIGateway()
