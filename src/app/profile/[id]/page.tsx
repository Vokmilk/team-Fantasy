import { SelectionWithDetails } from '@/types'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export const revalidate = 0

export default async function UserProfile({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>
	searchParams: Promise<{ tournamentId?: string }>
}) {
	const resolvedParams = await params
	const resolvedSearchParams = await searchParams

	const userId = resolvedParams.id
	const queryTournamentId = resolvedSearchParams.tournamentId

	const supabase = await createClient()

	// 1. Определяем Активный Турнир (если в URL нет ID)
	let activeTournamentId = queryTournamentId ? Number(queryTournamentId) : null

	if (!activeTournamentId) {
		const { data: activeTour } = await supabase
			.from('tournaments')
			.select('id')
			.eq('is_active', true)
			.single()
		activeTournamentId = activeTour?.id
	}

	if (!activeTournamentId) return <div>Турнир не найден</div>

	// 2. Получаем данные профиля
	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', userId)
		.single()

	// 3. Получаем пики СТРОГО для этого турнира
	// Используем !inner у baskets, чтобы отфильтровать лишнее
	const { data: selectionsData } = await supabase
		.from('selections')
		.select(
			`
      players!inner (
        name, cost, points,
        baskets!inner ( name, sort_order, tournament_id )
      )
    `
		)
		.eq('user_id', userId)
		.eq('players.baskets.tournament_id', activeTournamentId) // <--- ВОТ ЭТОГО НЕ ХВАТАЛО

	const selections = selectionsData as unknown as SelectionWithDetails[]

	// 4. Считаем суммы
	const totalPoints =
		selections?.reduce((acc, s) => acc + s.players.points, 0) || 0
	const totalCost = selections?.reduce((acc, s) => acc + s.players.cost, 0) || 0

	return (
		<div className='max-w-4xl mx-auto pb-20'>
			<div className='mb-6 flex items-center gap-4'>
				{/* Возвращаемся в таблицу с сохранением фильтра турнира */}
				<Link
					href={`/picks?tournamentId=${activeTournamentId}`}
					className='p-2 bg-gray-800 rounded hover:bg-gray-700'
				>
					← Назад
				</Link>
				<h1 className='text-3xl font-bold text-white'>
					{profile?.username || profile?.email?.split('@')[0] || 'Пользователь'}
				</h1>
			</div>

			<div className='grid grid-cols-2 gap-4 mb-8'>
				<div className='bg-gray-900 p-6 rounded-xl border border-gray-800 text-center'>
					<div className='text-gray-400 mb-1'>Очки команды</div>
					<div className='text-4xl font-bold text-blue-400'>{totalPoints}</div>
				</div>
				<div className='bg-gray-900 p-6 rounded-xl border border-gray-800 text-center'>
					<div className='text-gray-400 mb-1'>Стоимость состава</div>
					<div className='text-4xl font-bold text-purple-400'>{totalCost}</div>
				</div>
			</div>

			<h2 className='text-xl font-bold mb-4 text-white'>Состав команды</h2>

			{selections?.length === 0 ? (
				<div className='p-8 text-center bg-gray-900 rounded-xl border border-gray-800 text-gray-500'>
					Пользователь еще не собрал команду в этом турнире.
				</div>
			) : (
				<div className='bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-lg'>
					<table className='w-full text-left'>
						<thead className='bg-gray-950/50 text-gray-400 border-b border-gray-800 text-xs uppercase'>
							<tr>
								<th className='p-4'>Корзина</th>
								<th className='p-4'>Игрок</th>
								<th className='p-4 text-right'>Цена</th>
								<th className='p-4 text-right'>Очки</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-gray-800'>
							{selections
								?.sort(
									(a, b) =>
										a.players.baskets.sort_order - b.players.baskets.sort_order
								)
								.map((s, idx) => (
									<tr key={idx} className='hover:bg-gray-800/30'>
										<td className='p-4 text-gray-400 font-medium'>
											{s.players.baskets.name}
										</td>
										<td className='p-4 font-bold text-white text-lg'>
											{s.players.name}
										</td>
										<td className='p-4 text-right font-mono text-yellow-600'>
											{s.players.cost}
										</td>
										<td className='p-4 text-right font-bold text-blue-400'>
											{s.players.points}
										</td>
									</tr>
								))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
