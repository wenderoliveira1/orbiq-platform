import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { login } from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (data?.claims) {
    redirect('/dashboard')
  }

  const params = (await searchParams) ?? {}
  const error = typeof params.error === 'string' ? params.error : ''
  const message = typeof params.message === 'string' ? params.message : ''

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <div className="brand-lockup">
          <div className="brand-mark">O</div>
          <div>
            <strong>Orbiq</strong>
            <span>Automotive Operations Platform</span>
          </div>
        </div>

        <div className="brand-copy">
          <span className="eyebrow">NOVA PLATAFORMA</span>
          <h1>Gestão de oficina sem perder tempo.</h1>
          <p>Clientes, veículos, orçamentos, cotações e compras em uma única operação.</p>
        </div>

        <small>Ambiente local de desenvolvimento</small>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow red">ACESSO SEGURO</span>
          <h2>Entrar no Orbiq</h2>
          <p className="muted">Use seu e-mail e senha para acessar sua oficina.</p>

          {message ? <div className="notice success">{message}</div> : null}
          {error ? <div className="notice error">{error}</div> : null}

          <form action={login} className="form-stack">
            <label>
              <span>E-mail</span>
              <input name="email" type="email" autoComplete="email" required placeholder="voce@empresa.com.br" />
            </label>

            <label>
              <span>Senha</span>
              <input name="password" type="password" autoComplete="current-password" required minLength={6} placeholder="Sua senha" />
            </label>

            <button className="primary-button" type="submit">Entrar no Orbiq</button>
          </form>

          <p className="auth-footer">
            Ainda não tem conta? <Link href="/signup">Criar primeira conta</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
