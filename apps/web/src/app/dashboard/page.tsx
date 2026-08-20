import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from './actions'

const modules = [
  ['Novo orçamento', 'Atendimento rápido e preciso para a oficina.'],
  ['Clientes', 'Cadastro, histórico e relacionamento.'],
  ['Veículos', 'Veículos vinculados aos clientes.'],
  ['Cotações', 'Fornecedores, valores e disponibilidade.'],
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = String(data?.claims?.sub ?? '')

  if (!userId) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug, plan')
    .eq('id', membership.organization_id)
    .single()

  return (
    <main className="dashboard-shell">
      <header className="app-header">
        <div className="brand-lockup dark-text">
          <div className="brand-mark">O</div>
          <div><strong>Orbiq</strong><span>{organization?.name ?? 'Oficina'}</span></div>
        </div>

        <div className="header-actions">
          <span className="status-pill">Backend conectado</span>
          <form action={logout}><button className="ghost-button" type="submit">Sair</button></form>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="hero-row">
          <div>
            <span className="eyebrow red">PAINEL PRINCIPAL</span>
            <h1>{organization?.name ?? 'Sua oficina'}</h1>
            <p className="muted">Fundação segura, multiempresa e pronta para receber os módulos operacionais do Orbiq.</p>
          </div>
          <div className="org-chip">{membership.role}</div>
        </div>

        <div className="module-grid">
          {modules.map(([name, description]) => (
            <article className="module-card" key={name}>
              <div className="module-dot" />
              <span className="module-status">EM BREVE</span>
              <h2>{name}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>

        <section className="foundation-card">
          <div>
            <span>FUNDAÇÃO</span>
            <h2>Arquitetura profissional ativa.</h2>
            <p>Autenticação, PostgreSQL, RLS, multiempresa e sessão SSR fazem parte da nova base.</p>
          </div>
          <div className="foundation-meta">
            <small>Organização</small>
            <strong>{organization?.slug}</strong>
            <small>Plano</small>
            <strong>{organization?.plan ?? 'internal'}</strong>
          </div>
        </section>
      </section>
    </main>
  )
}
