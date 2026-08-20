'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createOrganization(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const cnpj = String(formData.get('cnpj') ?? '').trim()
  const requestedSlug = String(formData.get('slug') ?? '').trim()
  const slug = slugify(requestedSlug || name)

  if (name.length < 2 || !slug) {
    redirect('/onboarding?error=' + encodeURIComponent('Informe o nome da oficina.'))
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()

  if (!authData?.claims) {
    redirect('/login')
  }

  const { error } = await supabase.rpc('create_organization', {
    organization_name: name,
    organization_slug: slug,
    organization_cnpj: cnpj || null,
  })

  if (error) {
    const duplicated = error.message.toLowerCase().includes('duplicate') || error.message.toLowerCase().includes('unique')
    const message = duplicated ? 'Esse identificador de oficina já está em uso.' : error.message
    redirect('/onboarding?error=' + encodeURIComponent(message))
  }

  redirect('/dashboard')
}
