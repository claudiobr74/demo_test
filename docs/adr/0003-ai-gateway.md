# ADR 0003 — IA como gateway substituível com human-in-the-loop

## Status

Aceito

## Contexto

O diferencial não pode ser “usamos o modelo X”. A inteligência clínica deve permanecer no SerenaPsi.

## Decisão

Features chamam apenas o Serena AI Gateway. Model Registry configura provedores por ambiente. Resultados são sugestões estruturadas; somente a profissional promove alterações oficiais. Com IA indisponível, modo offline assistivo mantém o fluxo clínico.

## Consequências

- Sem acoplamento irreversível a OpenAI/Gemini
- Observabilidade de custo sem armazenar prompts clínicos completos
- Produto utilizável mesmo com outage de LLM
