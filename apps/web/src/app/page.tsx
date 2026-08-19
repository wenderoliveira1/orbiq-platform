const modules = [
  { title: "Orcamentos", description: "Atendimentos, servicos, pecas e aprovacao." },
  { title: "Clientes", description: "Historico completo de clientes e veiculos." },
  { title: "Cotacoes", description: "Fornecedores, valores e disponibilidade." },
  { title: "Compras", description: "Controle das pecas aprovadas e pedidos." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-600 font-black text-white">
              O
            </div>
            <div>
              <h1 className="font-semibold">Orbiq</h1>
              <p className="text-xs text-slate-500">Automotive Operations Platform</p>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">
            Platform 0.1
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-red-600">
          Nova geracao
        </p>

        <h2 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
          O novo Orbiq comecou.
        </h2>

        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          Estamos migrando o Orbiq para uma plataforma web e mobile profissional,
          segura, multiempresa e preparada para crescer.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <article
              key={module.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span className="mb-8 block h-2.5 w-2.5 rounded-full bg-red-600" />
              <h3 className="font-semibold">{module.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {module.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-950 p-6 text-white">
            <p className="text-xs text-slate-400">Web</p>
            <p className="mt-2 text-lg font-semibold">Next.js + TypeScript</p>
          </div>

          <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            <p className="text-xs text-slate-400">Backend</p>
            <p className="mt-2 text-lg font-semibold">PostgreSQL + Supabase</p>
          </div>

          <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            <p className="text-xs text-slate-400">Mobile</p>
            <p className="mt-2 text-lg font-semibold">React Native + Expo</p>
          </div>
        </div>
      </section>
    </main>
  );
}
