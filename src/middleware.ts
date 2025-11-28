import { type NextRequest } from 'next/server'
import { updateSession } from './utils/supabase/middleware'

export async function middleware(request: NextRequest) {
	return await updateSession(request)
}

export const config = {
	matcher: [
		// Мы добавили '|api' в список исключений (где не надо запускать middleware)
		// Теперь строка выглядит так: (?!_next/static|_next/image|favicon.ico|api|...
		'/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
	],
}
