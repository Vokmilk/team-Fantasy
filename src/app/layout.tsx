import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { signOut } from './actions'
import './globals.css'

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()

	return (
		<html lang='ru'>
			<body className='bg-gray-950 text-gray-100 min-h-screen'>
				{user && (
					<nav className='border-b border-gray-800 p-4 flex gap-6 items-center justify-center bg-gray-900'>
						<Link href='/' className='hover:text-blue-400 font-medium'>
							Мой Кабинет
						</Link>
						<Link href='/picks' className='hover:text-blue-400 font-medium'>
							Все выборы
						</Link>
						<Link href='/stats' className='hover:text-blue-400 font-medium'>
							Статистика
						</Link>
						<form action={signOut}>
							<button className='text-red-400 text-sm hover:text-red-300 ml-4'>
								Выйти
							</button>
						</form>
					</nav>
				)}
				<main className='container mx-auto p-4'>{children}</main>
			</body>
		</html>
	)
}
