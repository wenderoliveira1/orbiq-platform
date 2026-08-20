import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signup } from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignupPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (data?.claims) {
    redirect('/dashboard')
  }

  const params = (await searchParams) ?? {}
  const error = typeof params.error === 'string' ? params.error : ''

  return (
    <main className="auth-shell single">
      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand">
            <div className="brand-mark">O</div>
            <div><strong>Orbiq</strong><span>Automotive Operations Platform</span></div>
          </div>

          <span className="eyebrow red">PRIMEIRO ACESSO</span>
          <h2>Criar sua conta</h2>
          <p className="muted">Este usuário será o proprietário da primeira oficina cadastrada.</p>

          {error ? <div className="notice error">{error}</div> : null}

          <form action={signup} className="form-stack">
            <label>
              <span>Nome</span>
              <input name="name" required minLength={2} autoComplete="name" placeholder="Seu nome" />
            </label>

            <label>
              <span>E-mail</span>
              <input name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com.br" />
            </label>

            <label>
              <span>Senha</span>
              <input name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
            </label>

            <button className="primary-button" type="submit">Criar conta</button>
          </form>

          <p className="auth-footer">Já tem conta? <Link href="/login">Voltar ao login</Link></p>
        </div>
      </section>
    </main>
  )
}
