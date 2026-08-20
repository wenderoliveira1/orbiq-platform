import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createOrganization } from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = String(data?.claims?.sub ?? '')

  if (!userId) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (membership) {
    redirect('/dashboard')
  }

  const params = (await searchParams) ?? {}
  const error = typeof params.error === 'string' ? params.error : ''

  return (
    <main className="page-shell narrow">
      <header className="simple-header">
        <div className="brand-lockup dark-text">
          <div className="brand-mark">O</div>
          <div><strong>Orbiq</strong><span>Configuração inicial</span></div>
        </div>
      </header>

      <section className="setup-card">
        <span className="eyebrow red">PRIMEIRA OFICINA</span>
        <h1>Configure sua operação</h1>
        <p className="muted">Criaremos a primeira organização multiempresa e sua conta será vinculada como proprietária.</p>

        {error ? <div className="notice error">{error}</div> : null}

        <form action={createOrganization} className="form-stack roomy">
          <label>
            <span>Nome da oficina</span>
            <input name="name" required minLength={2} placeholder="Ex.: Minha Automotiva" />
          </label>

          <label>
            <span>Identificador</span>
            <input name="slug" placeholder="Ex.: minha-automotiva" />
            <small>Se deixar vazio, o Orbiq cria automaticamente a partir do nome.</small>
          </label>

          <label>
            <span>CNPJ <em>opcional</em></span>
            <input name="cnpj" placeholder="00.000.000/0000-00" />
          </label>

          <button className="primary-button" type="submit">Criar oficina e entrar</button>
        </form>
      </section>
    </main>
  )
}
