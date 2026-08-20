'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signup(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (name.length < 2) {
    redirect('/signup?error=' + encodeURIComponent('Informe seu nome.'))
  }

  if (!email || password.length < 6) {
    redirect('/signup?error=' + encodeURIComponent('Informe um e-mail válido e senha com pelo menos 6 caracteres.'))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  })

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }

  if (!data.session) {
    redirect('/login?message=' + encodeURIComponent('Conta criada. Confirme seu e-mail para continuar.'))
  }

  redirect('/onboarding')
}
