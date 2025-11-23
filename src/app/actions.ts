'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// --- AUTH ---

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(email: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback?next=/update-password`,
  })
  return { error: error?.message, success: !error }
}

// --- FANTASY LOGIC ---

export async function saveSelection(basket: number, playerId: number) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Используем UPSERT (вставка или обновление)
  // Ключ (user_id, basket) гарантирует уникальность
  const { error } = await supabase
    .from('selections')
    .upsert(
      { user_id: user.id, basket, player_id: playerId },
      { onConflict: 'user_id, basket' }
    )

  if (error) throw new Error(error.message)

  revalidatePath('/') // Обновляем главную
  revalidatePath('/picks') // Обновляем общую таблицу
  revalidatePath('/stats') // Обновляем статистику
}