"""Clinical/admin documents — templates and drafts (no external storage yet)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext
from app.application.audit import write_audit
from app.core.errors import NotFoundError, ValidationAppError
from app.core.permissions import Permission
from app.infrastructure.db.models_clinical import Patient
from app.infrastructure.db.models_ops import Document, DocumentTemplate

DEFAULT_TEMPLATES = [
    (
        "attendance_declaration",
        "Declaração de comparecimento",
        (
            "Declaro que {{patient_name}} compareceu a atendimento psicológico "
            "em {{date}}, com duração aproximada de {{duration}} minutos, "
            "realizado por {{professional_name}}.\n\n{{clinic_name}}"
        ),
        ["patient_name", "date", "duration", "professional_name", "clinic_name"],
    ),
    (
        "receipt",
        "Recibo de sessão",
        (
            "Recibo referente à sessão de {{patient_name}} em {{date}}, "
            "no valor de R$ {{amount}}.\n\n{{professional_name}}\n{{clinic_name}}"
        ),
        ["patient_name", "date", "amount", "professional_name", "clinic_name"],
    ),
    (
        "clinical_summary",
        "Resumo clínico (rascunho)",
        (
            "Paciente: {{patient_name}}\nData: {{date}}\n"
            "Profissional: {{professional_name}}\n\n"
            "Resumo:\n{{summary}}\n"
        ),
        ["patient_name", "date", "professional_name", "summary"],
    ),
]


class DocumentService:
    def __init__(self, db: AsyncSession, auth: AuthContext) -> None:
        self.db = db
        self.auth = auth

    async def list_templates(self) -> list[dict]:
        self.auth.require(Permission.DOCUMENT_READ)
        await self.ensure_default_templates()
        rows = (
            await self.db.execute(
                select(DocumentTemplate)
                .where(
                    DocumentTemplate.organization_id == self.auth.organization_id,
                    DocumentTemplate.is_active.is_(True),
                )
                .order_by(DocumentTemplate.name)
            )
        ).scalars().all()
        return [self._template_dto(t) for t in rows]

    async def ensure_default_templates(self) -> None:
        existing = await self.db.scalar(
            select(DocumentTemplate.id).where(
                DocumentTemplate.organization_id == self.auth.organization_id
            ).limit(1)
        )
        if existing:
            return
        for doc_type, name, body, variables in DEFAULT_TEMPLATES:
            self.db.add(
                DocumentTemplate(
                    organization_id=self.auth.organization_id,
                    doc_type=doc_type,
                    name=name,
                    body_template=body,
                    variables=variables,
                    is_active=True,
                )
            )
        await self.db.commit()

    async def list_documents(
        self,
        *,
        patient_id: uuid.UUID | None = None,
        limit: int = 50,
    ) -> list[dict]:
        self.auth.require(Permission.DOCUMENT_READ)
        q = select(Document).where(Document.organization_id == self.auth.organization_id)
        if patient_id:
            q = q.where(Document.patient_id == patient_id)
        rows = (
            await self.db.execute(q.order_by(Document.created_at.desc()).limit(min(limit, 100)))
        ).scalars().all()
        return [self._doc_dto(d) for d in rows]

    async def create(self, data: dict) -> dict:
        self.auth.require(Permission.DOCUMENT_WRITE)
        patient = None
        patient_id = data.get("patient_id")
        if patient_id:
            patient = await self._owned_patient(
                patient_id if isinstance(patient_id, uuid.UUID) else uuid.UUID(str(patient_id))
            )

        template = None
        template_id = data.get("template_id")
        if template_id:
            tid = template_id if isinstance(template_id, uuid.UUID) else uuid.UUID(str(template_id))
            template = await self.db.get(DocumentTemplate, tid)
            if template is None or template.organization_id != self.auth.organization_id:
                raise NotFoundError("Modelo de documento não encontrado.")

        doc_type = data.get("doc_type") or (template.doc_type if template else "custom")
        title = data.get("title") or (template.name if template else "Documento")
        body = data.get("body")
        if body is None and template is not None:
            variables = {
                "patient_name": patient.display_name if patient else "Paciente",
                "date": datetime.now(UTC).astimezone().strftime("%d/%m/%Y"),
                "duration": "50",
                "amount": "",
                "summary": "",
                "professional_name": self.auth.user.full_name,
                "clinic_name": "",
            }
            variables.update(data.get("variables") or {})
            body = _render(template.body_template, variables)
        if not body or not str(body).strip():
            raise ValidationAppError("Conteúdo do documento obrigatório.")

        doc = Document(
            organization_id=self.auth.organization_id,
            patient_id=patient.id if patient else None,
            template_id=template.id if template else None,
            doc_type=doc_type,
            title=title,
            body=str(body).strip(),
            status="draft",
            created_by_user_id=self.auth.user_id,
        )
        self.db.add(doc)
        await self.db.flush()
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="document.created",
            resource_type="document",
            resource_id=str(doc.id),
            request_id=self.auth.request_id,
            metadata={"doc_type": doc_type},
        )
        await self.db.commit()
        await self.db.refresh(doc)
        return self._doc_dto(doc)

    async def get(self, document_id: uuid.UUID) -> dict:
        self.auth.require(Permission.DOCUMENT_READ)
        doc = await self._owned_doc(document_id)
        return self._doc_dto(doc)

    async def finalize(self, document_id: uuid.UUID) -> dict:
        self.auth.require(Permission.DOCUMENT_WRITE)
        doc = await self._owned_doc(document_id)
        if doc.status == "finalized":
            return self._doc_dto(doc)
        doc.status = "finalized"
        doc.finalized_at = datetime.now(UTC)
        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="document.finalized",
            resource_type="document",
            resource_id=str(doc.id),
            request_id=self.auth.request_id,
        )
        await self.db.commit()
        return self._doc_dto(doc)

    async def export_payload(self, document_id: uuid.UUID, *, fmt: str = "html") -> dict:
        """Export printable artifact — HTML/text now; PDF binary storage later."""
        self.auth.require(Permission.DOCUMENT_READ)
        doc = await self._owned_doc(document_id)
        fmt = (fmt or "html").lower()
        if fmt not in {"html", "txt", "pdf"}:
            raise ValidationAppError("Formato de exportação inválido.")

        patient_name = ""
        if doc.patient_id:
            patient = await self.db.get(Patient, doc.patient_id)
            if patient and patient.organization_id == self.auth.organization_id:
                patient_name = patient.display_name

        generated_at = datetime.now(UTC).astimezone().strftime("%d/%m/%Y %H:%M")
        if fmt == "txt":
            content = (
                f"{doc.title}\n"
                f"{'=' * len(doc.title)}\n"
                f"Paciente: {patient_name or '—'}\n"
                f"Status: {doc.status}\n"
                f"Gerado em: {generated_at}\n\n"
                f"{doc.body}\n"
            )
            filename = f"{_slug(doc.title)}.txt"
            media_type = "text/plain; charset=utf-8"
        else:
            # html and pdf (print-ready HTML — browser/print-to-PDF)
            escaped_body = (
                doc.body.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\n", "<br/>")
            )
            content = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>{doc.title}</title>
  <style>
    body {{ font-family: Georgia, serif; max-width: 720px; margin: 40px auto; color: #2c3338; line-height: 1.5; }}
    h1 {{ font-size: 1.6rem; color: #4f7364; }}
    .meta {{ color: #5a646c; font-size: 0.95rem; margin-bottom: 24px; }}
    .body {{ white-space: normal; }}
    @media print {{ body {{ margin: 16mm; }} }}
  </style>
</head>
<body>
  <h1>{doc.title}</h1>
  <div class="meta">
    Paciente: {patient_name or "—"}<br/>
    Status: {doc.status}<br/>
    Gerado em: {generated_at}<br/>
    SerenaPsi — documento do consultório
  </div>
  <div class="body">{escaped_body}</div>
</body>
</html>
"""
            filename = f"{_slug(doc.title)}.html"
            media_type = "text/html; charset=utf-8"

        await write_audit(
            self.db,
            organization_id=self.auth.organization_id,
            actor_user_id=self.auth.user_id,
            action="document.exported",
            resource_type="document",
            resource_id=str(doc.id),
            request_id=self.auth.request_id,
            metadata={"format": fmt},
        )
        await self.db.commit()
        return {
            "document_id": str(doc.id),
            "format": "html" if fmt == "pdf" else fmt,
            "filename": filename,
            "media_type": media_type,
            "content": content,
            "print_hint": "Abra o HTML e use Imprimir → Salvar como PDF." if fmt in {"html", "pdf"} else None,
        }

    async def _owned_patient(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.db.get(Patient, patient_id)
        if (
            patient is None
            or patient.organization_id != self.auth.organization_id
            or patient.deleted_at is not None
        ):
            raise NotFoundError("Paciente não encontrado.")
        return patient

    async def _owned_doc(self, document_id: uuid.UUID) -> Document:
        doc = await self.db.get(Document, document_id)
        if doc is None or doc.organization_id != self.auth.organization_id:
            raise NotFoundError("Documento não encontrado.")
        return doc

    def _template_dto(self, t: DocumentTemplate) -> dict:
        return {
            "id": str(t.id),
            "doc_type": t.doc_type,
            "name": t.name,
            "body_template": t.body_template,
            "variables": t.variables,
        }

    def _doc_dto(self, d: Document) -> dict:
        return {
            "id": str(d.id),
            "patient_id": str(d.patient_id) if d.patient_id else None,
            "template_id": str(d.template_id) if d.template_id else None,
            "doc_type": d.doc_type,
            "title": d.title,
            "body": d.body,
            "status": d.status,
            "finalized_at": d.finalized_at.isoformat() if d.finalized_at else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }


def _render(template: str, variables: dict[str, str]) -> str:
    out = template
    for key, value in variables.items():
        out = out.replace("{{" + key + "}}", str(value))
    return out


def _slug(title: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in title.strip().lower())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return (cleaned.strip("-") or "documento")[:80]
