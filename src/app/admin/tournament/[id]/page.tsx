import { TournamentManager } from '@/components/admin/TournamentManager'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function TournamentEditPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	// 1. Получаем ID (асинхронно в Next.js 15)
	const resolvedParams = await params
	const { id } = resolvedParams

	const supabase = await createClient()

	// Проверка авторизации (на всякий случай дублируем, или надеемся на middleware)
	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) redirect('/login')

	// 2. Данные турнира
	const { data: tournament, error } = await supabase
		.from('tournaments')
		.select('*')
		.eq('id', id)
		.single()

	if (error || !tournament) {
		return (
			<div className='p-8 text-center text-red-500'>
				Турнир не найден (Ошибка: {error?.message})
			</div>
		)
	}

	// 3. Корзины + Игроки внутри них
	const { data: baskets } = await supabase
		.from('baskets')
		.select('*, players(*)')
		.eq('tournament_id', id)
		.order('sort_order')

	// 4. Внешний рейтинг (Источник)
	const { data: externalRatings } = await supabase
		.from('external_ratings')
		.select('*')
		.order('rank')
		.limit(200)

	return (
		<div className='max-w-[1600px] mx-auto p-4'>
			<div className='mb-6'>
				<a
					href='/admin'
					className='text-gray-400 hover:text-white mb-2 inline-block'
				>
					← Назад к списку
				</a>
				<h1 className='text-2xl font-bold'>
					Редактирование: {tournament.name}
				</h1>
			</div>

			<TournamentManager
				tournament={tournament}
				baskets={baskets || []}
				externalRatings={externalRatings || []}
			/>
		</div>
	)
}
