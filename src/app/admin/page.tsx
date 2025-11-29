import { createTournament } from '@/app/admin/action'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function AdminPage() {
	const supabase = await createClient()

	// 1. Получаем текущего юзера
	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) redirect('/login')

	// 2. ПРОВЕРКА АДМИНА ЧЕРЕЗ БАЗУ
	// Запрашиваем профиль и проверяем флаг is_admin
	const { data: profile } = await supabase
		.from('profiles')
		.select('is_admin')
		.eq('id', user.id)
		.single()

	// Если не админ — показываем 404 или ошибку
	if (!profile || !profile.is_admin) {
		return (
			<div className='flex items-center justify-center min-h-screen text-red-500 font-bold text-xl'>
				⛔ Доступ запрещен (403)
			</div>
		)
	}

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
							Number(fd.get('budget'))
						)
					}}
					className='flex gap-4 items-end'
				>
					<div className='flex-1'>
						<label className='block text-sm text-gray-400 mb-1'>Название</label>
						<input
							name='name'
							className='input-dark w-full'
							placeholder='Сезон 3'
							required
						/>
					</div>
					<div className='w-32'>
						<label className='block text-sm text-gray-400 mb-1'>Бюджет</label>
						<input
							name='budget'
							type='number'
							className='input-dark w-full'
							defaultValue='200'
							required
						/>
					</div>
					<button className='bg-green-600 px-6 py-3 rounded-lg font-bold hover:bg-green-500'>
						Создать
					</button>
				</form>
			</div>

			{/* Список */}
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
							<div className='text-gray-500 text-sm'>Бюджет: {t.budget}</div>
						</div>
						<Link
							href={`/admin/tournament/${t.id}`}
							className='bg-blue-600 px-4 py-2 rounded hover:bg-blue-500 transition'
						>
							Редактировать состав →
						</Link>
					</div>
				))}
			</div>
		</div>
	)
}
