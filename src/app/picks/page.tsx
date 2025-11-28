import { TournamentSelect } from '@/components/TournamentSelect'
import { LeaderboardRow, SelectionWithPlayer } from '@/types'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export const revalidate = 0

export default async function AllPicksPage({
	searchParams,
}: {
	searchParams: { [key: string]: string | string[] | undefined }
}) {
	const supabase = await createClient()

	// 1. Получаем турниры
	const { data: tournaments } = await supabase
		.from('tournaments')
		.select('id, name, is_active')
		.order('id', { ascending: false })

	if (!tournaments || tournaments.length === 0)
		return (
			<div className='p-4 text-center text-gray-400'>Нет данных о турнирах</div>
		)

	// 2. Определяем ID турнира
	const queryId = searchParams?.tournamentId
	const selectedTournamentId = queryId ? Number(queryId) : tournaments[0].id

	// 3. Получаем данные
	const { data: profiles } = await supabase.from('profiles').select('*')

	const { data: selectionsData } = await supabase
		.from('selections')
		.select(
			`
      user_id, 
      players!inner (
        name, cost, points,
        baskets!inner ( tournament_id )
      )
    `
		)
		.eq('players.baskets.tournament_id', selectedTournamentId)

	const selections = selectionsData as unknown as SelectionWithPlayer[]

	// 4. Сбор и сортировка статистики
	const rows: LeaderboardRow[] | undefined = profiles
		?.map(user => {
			const userPicks = selections?.filter(s => s.user_id === user.id) || []

			const totalPoints = userPicks.reduce(
				(acc, s) => acc + (s.players?.points || 0),
				0
			)
			const totalCost = userPicks.reduce(
				(acc, s) => acc + (s.players?.cost || 0),
				0
			)

			return {
				...user,
				badges: user.badges as string[],
				totalPoints,
				totalCost,
			}
		})
		.sort((a, b) => b.totalPoints - a.totalPoints)

	// Вспомогательная функция для иконки места
	const getRankIcon = (index: number) => {
		if (index === 0) return '🥇'
		if (index === 1) return '🥈'
		if (index === 2) return '🥉'
		return <span className='text-gray-500 font-mono'>#{index + 1}</span>
	}

	return (
		<div className='pb-20 max-w-5xl mx-auto'>
			{/* --- ШАПКА --- */}
			<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6'>
				<h1 className='text-2xl font-bold text-white'>Турнирная таблица</h1>
				<div className='w-full sm:w-auto'>
					<TournamentSelect
						tournaments={tournaments}
						activeId={selectedTournamentId}
					/>
				</div>
			</div>

			{/* Если нет участников */}
			{rows?.length === 0 && (
				<div className='p-8 text-center text-gray-500 bg-gray-900 rounded-lg border border-gray-800'>
					В этом турнире пока нет участников
				</div>
			)}

			{/* --- МОБИЛЬНАЯ ВЕРСИЯ (Список Карточек) --- */}
			<div className='block md:hidden space-y-3'>
				{rows?.map((user, idx) => (
					<Link
						key={user.id}
						href={`/profile/${user.id}?tournamentId=${selectedTournamentId}`}
						className='block'
					>
						<div className='bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between active:scale-[0.98] transition-transform shadow-md'>
							{/* Левая часть: Место + Имя */}
							<div className='flex items-center gap-4 overflow-hidden'>
								<div className='flex-shrink-0 w-8 text-center text-lg'>
									{getRankIcon(idx)}
								</div>
								<div className='flex flex-col truncate'>
									<span className='font-bold text-white truncate'>
										{user.username || user.email}
									</span>
									<span className='text-xs text-gray-500'>
										Бюджет: {user.totalCost}
									</span>
								</div>
							</div>

							{/* Правая часть: Очки */}
							<div className='flex flex-col items-end flex-shrink-0 pl-2'>
								<span className='text-xl font-bold text-blue-400'>
									{user.totalPoints}
								</span>
								<span className='text-[10px] uppercase text-gray-500 font-medium'>
									Очки
								</span>
							</div>
						</div>
					</Link>
				))}
			</div>

			{/* --- ДЕСКТОПНАЯ ВЕРСИЯ (Таблица) --- */}
			<div className='hidden md:block overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl'>
				<table className='w-full text-left border-collapse'>
					<thead className='bg-gray-950/50 text-gray-400 uppercase text-xs tracking-wider'>
						<tr>
							<th className='p-5 font-semibold'>Место</th>
							<th className='p-5 font-semibold'>Участник</th>
							<th className='p-5 text-right font-semibold'>Стоимость</th>
							<th className='p-5 text-right font-semibold'>Очки</th>
							<th className='p-5'></th>
						</tr>
					</thead>
					<tbody className='divide-y divide-gray-800'>
						{rows?.map((user, idx) => (
							<tr
								key={user.id}
								className='hover:bg-gray-800/50 transition-colors group'
							>
								<td className='p-5 font-medium text-lg w-16 text-center'>
									{getRankIcon(idx)}
								</td>
								<td className='p-5'>
									<div className='flex items-center gap-3'>
										{/* Аватарка-заглушка с инициалом */}
										<div className='w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold'>
											{(user.username || user.email || '?')[0].toUpperCase()}
										</div>
										<span className='font-medium text-white truncate max-w-[200px]'>
											{user.username || user.email}
										</span>
									</div>
								</td>
								<td className='p-5 text-right text-gray-400 font-mono'>
									{user.totalCost}
								</td>
								<td className='p-5 text-right font-bold text-blue-400 text-xl'>
									{user.totalPoints}
								</td>
								<td className='p-5 text-right'>
									<Link
										href={`/profile/${user.id}?tournamentId=${selectedTournamentId}`}
										className='inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-blue-400 bg-blue-400/10 rounded-full hover:bg-blue-400/20 transition-colors opacity-0 group-hover:opacity-100'
									>
										Состав →
									</Link>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
