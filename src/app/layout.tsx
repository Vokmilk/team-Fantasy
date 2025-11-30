import { Navigation } from '@/components/Navigation'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Toaster } from 'sonner'
import { signOut } from './actions'
import './globals.css'

export const metadata = {
	title: 'Fantasy League',
	description: 'Фентези турнир',
}

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const supabase = await createClient()

	const {
		data: { user },
	} = await supabase.auth.getUser()

	let isAdmin = false
	let displayName = ''

	if (user) {
		// Получаем профиль, чтобы узнать ник и права админа
		const { data: profile } = await supabase
			.from('profiles')
			.select('username, is_admin')
			.eq('id', user.id)
			.single()

		isAdmin = !!profile?.is_admin
		// Логика: Если есть ник - берем его, иначе обрезаем email до собачки
		displayName = profile?.username || user.email?.split('@')[0] || 'Игрок'
	}

	return (
		<html lang='ru'>
			<body className='bg-gray-950 text-gray-100 min-h-screen flex flex-col'>
				<Toaster position='top-center' richColors theme='dark' />
				{user && (
					<header className='border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-50'>
						<div className='container mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4'>
							<Link
								href='/'
								className='text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent hover:opacity-80 transition'
							>
								Fantasy League
							</Link>

							<Navigation isAdmin={isAdmin} />

							<div className='flex items-center gap-4'>
								{/* Отображаем Никнейм */}
								<div className='hidden md:block text-sm text-gray-400'>
									{displayName}
								</div>

								<form action={signOut}>
									<button className='text-xs font-medium text-red-400 hover:text-red-300 border border-red-900/30 hover:bg-red-900/20 px-3 py-1.5 rounded transition'>
										Выйти
									</button>
								</form>
							</div>
						</div>
					</header>
				)}

				<main className='container mx-auto p-4 md:p-6 flex-1'>{children}</main>

				<footer className='border-t border-gray-900 p-6 text-center text-gray-600 text-sm mt-auto'>
					&copy; {new Date().getFullYear()} Fantasy League
				</footer>
			</body>
		</html>
	)
}
