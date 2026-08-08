export default function KnowledgePage() {
  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-emerald-950">Conhecimento</h1>
        <p className="mt-1 text-emerald-800/80">
          Biblioteca clínica do consultório — substituindo NotebookLM / Google Drive.
        </p>
      </header>
      <section className="rounded-2xl border border-emerald-200 bg-white/70 p-6">
        <h2 className="font-serif text-xl text-emerald-900">Cadernos e frameworks</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-800/85">
          O modelo React original exportava material sanitizado para o Google NotebookLM. Nesta
          fundação, o conhecimento clínico permanece na SerenaPsi (case memory, formulação, plano
          terapêutico e futuros cadernos internos), sem pastas Drive nem sincronização Google.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-emerald-900">
          <li>Memória do caso com proveniência tipada</li>
          <li>Formulação viva (rascunho → oficial)</li>
          <li>Plano terapêutico e metas</li>
          <li>RAG / biblioteca TCC–Esquema–ACT (roadmap)</li>
        </ul>
      </section>
    </div>
  );
}
