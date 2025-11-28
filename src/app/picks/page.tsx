import { TournamentSelect } from '@/components/TournamentSelect'
import { LeaderboardRow, SelectionWithPlayer } from '@/types'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export const revalidate = 0

// В Next.js params и searchParams теперь Promise (в последних версиях),
// но пока работает и простая типизация, однако лучше подготовиться к async
export default async function AllPicksPage({
	searchParams,
}: {
	searchParams: { [key: string]: string | string[] | undefined }
}) {
	const supabase = await createClient()

	// 1. Получаем список всех турниров для селектора
	const { data: tournaments } = await supabase
		.from('tournaments')
		.select('id, name, is_active')
		.order('id', { ascending: false }) // Сначала новые

	if (!tournaments || tournaments.length === 0) return <div>Нет данных</div>

	// 2. Определяем, какой турнир показывать
	// Если в URL есть id - берем его, иначе берем самый последний (первый в списке)
	const queryId = searchParams?.tournamentId
	const selectedTournamentId = queryId ? Number(queryId) : tournaments[0].id

	// 3. Получаем данные ТОЛЬКО для выбранного турнира
	const { data: profiles } = await supabase.from('profiles').select('*')

	// Сложный запрос: Пики -> Игроки -> Корзины (где tournament_id = selected)
	// Используем !inner, чтобы отфильтровать пики, которые не относятся к турниру
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

	// 4. Сбор статистики (код почти не изменился, просто данные теперь отфильтрованы)
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

	return (
		<div>
			<div className='flex justify-between items-center mb-6'>
				<h1 className='text-2xl font-bold'>Турнирная таблица</h1>
				{/* Вставляем наш селектор */}
				<TournamentSelect
					tournaments={tournaments}
					activeId={selectedTournamentId}
				/>
			</div>

			<div className='overflow-hidden rounded-lg border border-gray-800 bg-gray-900'>
				<table className='w-full text-left'>
					<thead className='bg-gray-950 text-gray-400 uppercase text-xs'>
						<tr>
							<th className='p-4'>Место</th>
							<th className='p-4'>Участник</th>
							<th className='p-4 text-right'>Стоимость</th>
							<th className='p-4 text-right'>Очки</th>
							<th className='p-4'></th>
						</tr>
					</thead>
					<tbody className='divide-y divide-gray-800'>
						{rows?.length === 0 && (
							<tr>
								<td colSpan={5} className='p-8 text-center text-gray-500'>
									В этом турнире пока нет участников
								</td>
							</tr>
						)}
						{rows?.map((user, idx) => (
							<tr
								key={user.id}
								className='hover:bg-gray-800/50 group transition'
							>
								<td className='p-4 font-mono text-gray-500 w-12'>{idx + 1}</td>
								<td className='p-4 font-medium flex items-center gap-2'>
									{user.username || user.email}
									{idx < 3 && rows.length > 3 && (
										<span className='text-lg'>🏆</span>
									)}
								</td>
								<td className='p-4 text-right text-gray-400 font-mono'>
									{user.totalCost}
								</td>
								<td className='p-4 text-right font-bold text-blue-400 text-lg'>
									{user.totalPoints}
								</td>
								<td className='p-4 text-right'>
									{/* Передаем ID пользователя, на странице профиля тоже надо будет добавить фильтр */}
									<Link
										href={`/profile/${user.id}?tournamentId=${selectedTournamentId}`}
										className='text-sm text-blue-500 hover:text-blue-400 underline opacity-0 group-hover:opacity-100 transition'
									>
										Подробнее
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
