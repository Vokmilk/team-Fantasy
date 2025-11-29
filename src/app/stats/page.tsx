import { TournamentSelect } from '@/components/TournamentSelect'
import { createClient } from '@/utils/supabase/server'

export const revalidate = 0

export default async function StatsPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
	const supabase = await createClient()

	// 1. Получаем параметры (Next.js 15)
	const resolvedParams = await searchParams
	const queryId = resolvedParams.tournamentId

	// 2. Получаем список турниров
	const { data: tournaments } = await supabase
		.from('tournaments')
		.select('id, name, is_active')
		.order('id', { ascending: false })

	if (!tournaments || tournaments.length === 0)
		return <div className='p-8'>Нет данных</div>

	// 3. Определяем ID текущего турнира
	const selectedTournamentId = queryId ? Number(queryId) : tournaments[0].id

	// 4. Получаем данные (Игроки + Пики) ТОЛЬКО для этого турнира

	// Игроки
	const { data: players } = await supabase
		.from('players')
		.select('*, baskets!inner(tournament_id)')
		.eq('baskets.tournament_id', selectedTournamentId)

	// Пики (нужны для подсчета популярности)
	const { data: selections } = await supabase
		.from('selections')
		.select('player_id, players!inner(baskets!inner(tournament_id))')
		.eq('players.baskets.tournament_id', selectedTournamentId)

	// 5. Обработка статистики
	const stats = players?.map(player => {
		// Сколько раз выбрали этого игрока
		const pickCount =
			selections?.filter(s => s.player_id === player.id).length || 0

		// Эффективность (Очки / Стоимость)
		// Защита от деления на ноль
		const efficiency =
			player.cost > 0 ? (player.points / player.cost).toFixed(2) : '0.00'

		return {
			...player,
			pickCount,
			efficiency: Number(efficiency),
		}
	})

	// Сортировка по умолчанию: по популярности (Pick Count)
	// Можно сделать сортировку по очкам или эффективности, но популярность для драфта интереснее
	const sortedStats = stats?.sort((a, b) => b.pickCount - a.pickCount)

	// Общее кол-во пиков (для расчета процента полоски)
	const maxPicks = sortedStats?.[0]?.pickCount || 1

	return (
		<div className='pb-20 max-w-5xl mx-auto'>
			{/* Шапка с выбором турнира */}
			<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6'>
				<h1 className='text-2xl font-bold text-white'>Статистика игроков</h1>
				<div className='w-full sm:w-auto'>
					<TournamentSelect
						tournaments={tournaments}
						activeId={selectedTournamentId}
					/>
				</div>
			</div>

			<div className='grid gap-4'>
				{sortedStats?.map((p, idx) => (
					<div
						key={p.id}
						className='bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col md:flex-row items-center gap-4 shadow-sm hover:border-gray-700 transition'
					>
						{/* Инфо об игроке */}
						<div className='flex items-center gap-4 flex-1 w-full'>
							<div className='bg-gray-800 w-8 h-8 flex flex-shrink-0 items-center justify-center rounded font-bold text-gray-400 text-sm'>
								#{idx + 1}
							</div>
							<div className='min-w-0'>
								<div className='font-bold text-lg text-white truncate'>
									{p.name}
								</div>
								<div className='text-xs text-gray-500 flex gap-3'>
									<span>Корзина {p.basket_id}</span>
									<span className='text-yellow-600'>Цена: {p.cost}</span>
									<span className='text-blue-400'>Очки: {p.points}</span>
								</div>
							</div>
						</div>

						{/* Метрики (Эффективность + Пики) */}
						<div className='flex items-center gap-6 w-full md:w-auto justify-between md:justify-end'>
							{/* КПД */}
							<div className='text-center px-2'>
								<div
									className={`text-xl font-bold ${
										p.efficiency > 1 ? 'text-green-400' : 'text-gray-400'
									}`}
								>
									{p.efficiency}
								</div>
								<div className='text-[10px] uppercase text-gray-600 font-bold'>
									КПД (Pts/Cost)
								</div>
							</div>

							{/* Полоска популярности */}
							<div className='flex items-center gap-3 min-w-[120px]'>
								<div className='flex-1 h-2 w-24 bg-gray-800 rounded-full overflow-hidden'>
									<div
										className='h-full bg-blue-600 rounded-full'
										style={{ width: `${(p.pickCount / maxPicks) * 100}%` }}
									/>
								</div>
								<div className='text-right'>
									<span className='font-bold text-white text-lg'>
										{p.pickCount}
									</span>
									<div className='text-[10px] text-gray-500'>пиков</div>
								</div>
							</div>
						</div>
					</div>
				))}

				{sortedStats?.length === 0 && (
					<div className='p-8 text-center text-gray-500'>
						В этом турнире нет игроков
					</div>
				)}
			</div>
		</div>
	)
}
