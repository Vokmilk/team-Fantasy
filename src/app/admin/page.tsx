import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createTournament } from './actions'

export const revalidate = 0

export default async function AdminPage() {
	const supabase = await createClient()

	// 1. Проверка админа
	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) redirect('/login')

	const { data: profile } = await supabase
		.from('profiles')
		.select('is_admin')
		.eq('id', user.id)
		.single()

	if (!profile || !profile.is_admin) {
		return (
			<div className='flex items-center justify-center min-h-screen text-red-500 font-bold text-xl'>
				⛔ Доступ запрещен (403)
			</div>
		)
	}

	// 2. Получаем список турниров
	const { data: tournaments } = await supabase
		.from('tournaments')
		.select('*')
		.order('id', { ascending: false })

	return (
		<div className='max-w-4xl mx-auto p-6'>
			<h1 className='text-3xl font-bold mb-8'>Управление турнирами</h1>

			{/* Форма создания */}
			<div className='bg-gray-900 p-6 rounded-xl border border-gray-800 mb-8'>
				<h2 className='text-xl font-bold mb-4'>Создать новый турнир</h2>
				<form
					action={async fd => {
						'use server'
						await createTournament(
							fd.get('name') as string,
							Number(fd.get('budget')),
							fd.get('slug') as string // <--- 3-й аргумент (Slug)
						)
					}}
					className='flex flex-col md:flex-row gap-4 items-end'
				>
					<div className='flex-1 w-full'>
						<label className='block text-sm text-gray-400 mb-1'>Название</label>
						<input
							name='name'
							className='input-dark w-full'
							placeholder='Зимний кубок'
							required
						/>
					</div>

					<div className='flex-1 w-full'>
						<label className='block text-sm text-gray-400 mb-1'>
							Slug (URL)
						</label>
						<input
							name='slug'
							className='input-dark w-full'
							placeholder='winter-cup-2025'
							required
						/>
					</div>

					<div className='w-full md:w-32'>
						<label className='block text-sm text-gray-400 mb-1'>Бюджет</label>
						<input
							name='budget'
							type='number'
							className='input-dark w-full'
							defaultValue='200'
							required
						/>
					</div>

					<button className='bg-green-600 px-6 py-2.5 rounded-lg font-bold hover:bg-green-500 w-full md:w-auto'>
						Создать
					</button>
				</form>
			</div>

			{/* Список турниров */}
			<div className='space-y-4'>
				{tournaments?.map(t => (
					<div
						key={t.id}
						className='bg-gray-900 p-4 rounded-xl border border-gray-800 flex justify-between items-center'
					>
						<div>
							<div className='font-bold text-lg flex items-center gap-2'>
								{t.name}
								{t.is_active ? (
									<span className='bg-green-900 text-green-200 text-xs px-2 py-1 rounded'>
										ACTIVE
									</span>
								) : (
									<span className='bg-gray-800 text-gray-400 text-xs px-2 py-1 rounded'>
										ARCHIVE
									</span>
								)}
							</div>
							<div className='text-gray-500 text-xs mt-1'>
								Slug:{' '}
								<span className='font-mono text-yellow-600'>{t.slug}</span> |
								Бюджет: {t.budget}
							</div>
						</div>
						<Link
							href={`/admin/tournament/${t.id}`}
							className='bg-blue-600 px-4 py-2 rounded hover:bg-blue-500 transition text-sm font-medium'
						>
							Редактировать →
						</Link>
					</div>
				))}
			</div>
		</div>
	)
}
