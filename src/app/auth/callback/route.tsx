import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Если параметра next нет, отправляем на главную
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Если обмен прошел успешно, перенаправляем пользователя
      // на страницу смены пароля (или куда указывал next)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Если ошибка или нет кода — возвращаем на логин
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}