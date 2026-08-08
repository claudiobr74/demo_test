"""Serena AI Gateway — features never call providers directly.

Architecture:
  Features → Gateway → Privacy → Context Builder → Framework → Model Router → Providers
                      → Clinical Critic → Safety → Structured Output
"""

from __future__ import annotations

import json
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
        memory = raw_context.get("case_memory") or {}
        facts = raw_context.get("facts") or memory.get("facts") or []
        observations = raw_context.get("observations") or memory.get("observations") or []
        hypotheses = raw_context.get("hypotheses") or memory.get("hypotheses") or []
        selected = {
            "mode": mode.value,
            "patient_code": raw_context.get("patient_code"),
            "framework": raw_context.get("framework"),
            "formulation": raw_context.get("formulation"),
            "active_goals": (raw_context.get("active_goals") or [])[:10],
            "recent_facts": facts[:20],
            "recent_observations": observations[:20],
            "active_hypotheses": hypotheses[:15],
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
            return self._offline_assist(mode, framework_id, raw_context, user_message)
        # Offline unless at least one configured provider key exists for the resolved model.
        has_any_key = bool(settings.openai_api_key or settings.gemini_api_key)
        if not has_any_key:
            return self._offline_assist(mode, framework_id, raw_context, user_message)

        model_class = MODE_MODEL_CLASS[mode]
        spec = self.registry.resolve(model_class)
        minimized = self.privacy.minimize(raw_context)
        context = self.context_builder.build(mode, minimized)
        framework = self.frameworks.get(framework_id)

        try:
            from app.ai_gateway.providers import resolve_provider

            provider = resolve_provider(spec.provider)
            # Require matching API key for the selected provider
            if spec.provider == "openai" and not settings.openai_api_key:
                raise AppError(
                    "AI_PROVIDER_NOT_CONFIGURED",
                    "Chave OpenAI não configurada.",
                    status_code=503,
                )
            if spec.provider == "gemini" and not settings.gemini_api_key:
                raise AppError(
                    "AI_PROVIDER_NOT_CONFIGURED",
                    "Chave Gemini não configurada.",
                    status_code=503,
                )
            system = (
                "Você é o Supervisor Clínico SerenaPsi. Responda APENAS JSON válido com chaves: "
                "summary (objeto com message), hypotheses (lista de {text, epistemology}), "
                "observations (lista de {text}), suggested_focus (lista de strings), "
                "questions (lista de strings), missing_information (lista de strings). "
                "Nunca diga verdades absolutas. Hipóteses são working_hypothesis. "
                f"Framework: {framework['name']}."
            )
            user = json.dumps(
                {"mode": mode.value, "context": context, "message": user_message},
                ensure_ascii=False,
            )
            completion = await provider.complete(
                system=system, user=user, model=spec.model, temperature=0.2
            )
            content = completion["content"]
            result = StructuredSupervisorResult(
                summary=content.get("summary") or {"message": "Sugestão gerada pelo Supervisor."},
                hypotheses=content.get("hypotheses") or [],
                observations=content.get("observations") or [],
                suggested_focus=content.get("suggested_focus") or [],
                questions=content.get("questions") or [],
                missing_information=content.get("missing_information") or [],
                metadata={
                    "engine_version": ENGINE_VERSION,
                    "framework_version": framework["version"],
                    "framework": framework["id"],
                    "prompt_policy_version": "openai-1",
                    "provider": "openai",
                    "model": spec.model,
                    "model_class": model_class.value,
                    "input_tokens": completion.get("input_tokens", 0),
                    "output_tokens": completion.get("output_tokens", 0),
                },
            )
            text_blob = " ".join(
                [
                    user_message or "",
                    str(result.summary),
                    " ".join(result.suggested_focus),
                ]
            )
            result.alerts = self.safety.scan(text_blob)
            return self.critic.review(result, framework["id"])
        except AppError as exc:
            logger.warning("ai_provider_fallback", code=exc.code, message=str(exc))
            offline = self._offline_assist(mode, framework_id, raw_context, user_message)
            offline.metadata["fallback_from"] = spec.provider
            offline.metadata["fallback_reason"] = exc.code
            return offline

    async def propose_cfp_from_transcript(
        self,
        *,
        transcript: str,
        session_notes: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Structure a transcript into CFP clinical-record fields (suggestion only)."""
        notes = session_notes or {}
        if not settings.ai_enabled or not (settings.openai_api_key or settings.gemini_api_key):
            return self._offline_cfp_proposal(transcript, notes)

        spec = self.registry.resolve(ModelClass.FAST)
        try:
            from app.ai_gateway.providers import resolve_provider

            provider = resolve_provider(spec.provider)
            if spec.provider == "openai" and not settings.openai_api_key:
                return self._offline_cfp_proposal(transcript, notes)
            if spec.provider == "gemini" and not settings.gemini_api_key:
                return self._offline_cfp_proposal(transcript, notes)

            system = (
                "Você auxilia psicólogas a redigir anotações clínicas no modelo de prontuário "
                "indicado pelo Conselho Federal de Psicologia (CFP). "
                "Responda APENAS JSON válido com as chaves: "
                "focus, evolution, relevant_observations, interventions, tasks, planning, agreements. "
                "Nunca invente fatos clínicos. Se a transcrição for insuficiente, deixe o campo "
                "com orientação curta para a profissional completar. "
                "Não copie a transcrição bruta para evolution — sintetize em linguagem clínica. "
                "A proposta é sugestão; a profissional revisa e decide."
            )
            user = json.dumps(
                {
                    "transcript": transcript[:20_000],
                    "existing_notes": self.privacy.minimize(notes),
                },
                ensure_ascii=False,
            )
            completion = await provider.complete(
                system=system, user=user, model=spec.model, temperature=0.2
            )
            content = completion.get("content") or {}
            proposal = self._normalize_cfp_proposal(content, transcript)
            proposal["mode"] = "llm"
            proposal["metadata"] = {
                "engine_version": ENGINE_VERSION,
                "provider": spec.provider,
                "model": spec.model,
                "input_tokens": completion.get("input_tokens", 0),
                "output_tokens": completion.get("output_tokens", 0),
            }
            return proposal
        except Exception as exc:  # noqa: BLE001 — always fall back offline
            logger.warning("cfp_propose_fallback", error=type(exc).__name__)
            proposal = self._offline_cfp_proposal(transcript, notes)
            proposal["metadata"]["fallback_reason"] = type(exc).__name__
            return proposal

    def _offline_cfp_proposal(
        self, transcript: str, notes: dict[str, Any]
    ) -> dict[str, Any]:
        text = (transcript or "").strip()
        focus = (notes.get("focus") or "").strip()
        if not focus and text:
            first_line = text.splitlines()[0].strip()
            focus = first_line[:180] if first_line else "Revisar foco da sessão com a paciente"
        if not focus:
            focus = "Definir foco clínico da sessão (revisão humana)"

        evolution = (notes.get("observations") or "").strip()
        if not evolution:
            if text and not text.startswith("[Transcrição offline]"):
                snippet = text[:600].strip()
                evolution = (
                    "Proposta assistiva (modo offline) — revise antes de aceitar:\n"
                    f"{snippet}"
                    + ("…" if len(text) > 600 else "")
                )
            else:
                evolution = (
                    "Complete a evolução clínica no modelo CFP após revisar a sessão. "
                    "Nada entra no prontuário oficial sem o seu aceite no encerramento."
                )

        return {
            "transcript": text,
            "focus": focus,
            "evolution": evolution,
            "relevant_observations": (notes.get("events") or "").strip()
            or "Registrar observações relevantes da sessão (revisão humana).",
            "interventions": (notes.get("interventions") or "").strip()
            or "Descrever intervenções realizadas (revisão humana).",
            "tasks": (notes.get("tasks") or "").strip()
            or "Listar tarefas terapêuticas combinadas, se houver.",
            "planning": (notes.get("planning") or "").strip()
            or "Planejar próximo foco / continuidade do cuidado.",
            "agreements": (notes.get("agreements") or "").strip()
            or "Registrar combinados com a paciente, se houver.",
            "mode": "offline_assist",
            "epistemology_note": (
                "Sugestão estruturada no modelo CFP. Não é prontuário finalizado. "
                "A profissional revisa, edita e só então aplica nas notas da sessão."
            ),
            "metadata": {
                "engine_version": ENGINE_VERSION,
                "provider": "none",
                "model": "offline_cfp",
                "prompt_policy_version": "cfp-offline-1",
            },
        }

    def _normalize_cfp_proposal(self, content: dict[str, Any], transcript: str) -> dict[str, Any]:
        def _s(key: str, *alts: str) -> str:
            for k in (key, *alts):
                v = content.get(k)
                if isinstance(v, str) and v.strip():
                    return v.strip()
            return ""

        return {
            "transcript": transcript,
            "focus": _s("focus", "foco") or "Revisar foco da sessão",
            "evolution": _s("evolution", "evolucao", "evolução")
            or "Complete a evolução clínica (modelo CFP).",
            "relevant_observations": _s(
                "relevant_observations", "observacoes", "observações"
            )
            or "Registrar observações relevantes.",
            "interventions": _s("interventions", "intervencoes", "intervenções")
            or "Descrever intervenções.",
            "tasks": _s("tasks", "tarefas") or "Listar tarefas, se houver.",
            "planning": _s("planning", "planejamento") or "Planejar continuidade.",
            "agreements": _s("agreements", "combinados") or "Registrar combinados.",
            "epistemology_note": (
                "Sugestão estruturada no modelo CFP. Não é prontuário finalizado. "
                "A profissional revisa e decide."
            ),
        }

    def offline_transcript_stub(self, *, has_audio: bool) -> str:
        if has_audio:
            return (
                "[Transcrição offline] Áudio recebido. A STT automática está indisponível "
                "(IA desabilitada ou sem chave de provedor). Use o texto abaixo como base "
                "e complete os campos do modelo CFP com base na sessão."
            )
        return (
            "[Transcrição offline] Nenhum texto de fala foi enviado. "
            "Cole a transcrição ou grave com IA habilitada para obter STT automática."
        )

    def _offline_assist(
        self,
        mode: SupervisorMode,
        framework_id: str,
        raw_context: dict[str, Any],
        user_message: str | None,
    ) -> StructuredSupervisorResult:
        framework = self.frameworks.get(framework_id)
        memory = raw_context.get("case_memory") or {}
        formulation = raw_context.get("formulation") or {}
        facts = _as_text_items(raw_context.get("facts") or memory.get("facts") or [])
        observations = _as_text_items(
            raw_context.get("observations") or memory.get("observations") or []
        )
        hypotheses = _as_text_items(
            raw_context.get("hypotheses") or memory.get("hypotheses") or []
        )
        text_blob = " ".join(
            [
                user_message or "",
                str(raw_context.get("last_session_summary") or ""),
                str(raw_context.get("suggested_focus") or ""),
                str(formulation.get("therapeutic_focus") or ""),
            ]
        )
        alerts = self.safety.scan(text_blob)
        focus = (
            formulation.get("therapeutic_focus")
            or raw_context.get("suggested_focus")
            or "Revisar foco da última sessão e combinados em aberto"
        )
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
                {"text": f, "epistemology": Epistemology.DOCUMENTED_FACT.value}
                for f in facts[:5]
            ],
            observations=[
                {"text": o, "epistemology": Epistemology.CLINICAL_OBSERVATION.value}
                for o in observations[:5]
            ],
            hypotheses=[
                {
                    "text": h,
                    "epistemology": Epistemology.WORKING_HYPOTHESIS.value,
                    "evidence_ids": [],
                    "alternatives_considered": False,
                }
                for h in hypotheses[:5]
            ],
            missing_information=[
                "Confirme objetivos ativos com a paciente",
                "Verifique tarefas terapêuticas pendentes",
            ],
            suggested_focus=[focus] if isinstance(focus, str) else list(focus)[:3],
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


def _as_text_items(items: list[Any]) -> list[str]:
    out: list[str] = []
    for item in items:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict):
            text = item.get("text") or item.get("content") or item.get("statement")
            if text:
                out.append(str(text))
    return out


gateway = SerenaAIGateway()
