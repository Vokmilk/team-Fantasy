import { PicksControls } from '@/components/PicksControls' // Импорт нового компонента
import { TournamentSelect } from '@/components/TournamentSelect'
import { LeaderboardRow, SelectionWithPlayer } from '@/types'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export const revalidate = 0

// Вспомогательный компонент для заголовка с сортировкой
function SortableHeader({ label, sortKey, currentSort, currentDir }: any) {
	const isActive = currentSort === sortKey
	const dirArrow = isActive ? (currentDir === 'asc' ? '▲' : '▼') : ''

	// Генерируем ссылку для сортировки
	// Нам нужно сохранить текущие параметры (query, page) и поменять sort
	return (
		<Link
			href={{
				query: {
					...currentDir, // тут сложнее передать контекст в серверный компонент,
					// поэтому проще сделать Link с полным путем или клиентский компонент.
					// Но для простоты сделаем обычную ссылку с параметрами:
					sort: sortKey,
					dir: isActive && currentDir === 'desc' ? 'asc' : 'desc',
				},
			}}
			className={`font-semibold cursor-pointer select-none flex items-center gap-1 hover:text-white transition ${
				isActive ? 'text-white' : 'text-gray-400'
			}`}
		>
			{label} <span className='text-[10px]'>{dirArrow}</span>
		</Link>
	)
}

export default async function AllPicksPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
	const supabase = await createClient()
	const resolvedParams = await searchParams

	// --- ЧИТАЕМ ПАРАМЕТРЫ URL ---
	const queryId = resolvedParams.tournamentId
	const searchQuery = ((resolvedParams.query as string) || '').toLowerCase()
	const sortKey = (resolvedParams.sort as string) || 'points' // points | cost | name
	const sortDir = (resolvedParams.dir as string) || 'desc' // desc | asc
	const currentPage = Number(resolvedParams.page) || 1
	const ITEMS_PER_PAGE = 20

	// 1. Получаем турниры
	const { data: tournaments } = await supabase
		.from('tournaments')
		.select('id, name, is_active')
		.order('id', { ascending: false })

	if (!tournaments || tournaments.length === 0) return <div>Нет данных</div>

	const selectedTournamentId = queryId ? Number(queryId) : tournaments[0].id

	// 2. Получаем данные
	const { data: profiles } = await supabase.from('profiles').select('*')

	const { data: selectionsData } = await supabase
		.from('selections')
		.select(
			'user_id, players!inner(name, cost, points, baskets!inner(tournament_id))'
		)
		.eq('players.baskets.tournament_id', selectedTournamentId)

	const selections = selectionsData as unknown as SelectionWithPlayer[]

	// 3. АГРЕГАЦИЯ ДАННЫХ (Считаем суммы)
	let allRows: LeaderboardRow[] =
		profiles?.map(user => {
			const userPicks = selections?.filter(s => s.user_id === user.id) || []
			const totalPoints = userPicks.reduce(
				(acc, s) => acc + (s.players?.points || 0),
				0
			)
			const totalCost = userPicks.reduce(
				(acc, s) => acc + (s.players?.cost || 0),
				0
			)

			// Определяем имя для отображения сразу, чтобы по нему искать
			const displayName = user.username || user.email?.split('@')[0] || 'Аноним'

			return {
				...user,
				// Добавляем вычисленное имя в объект для удобства
				displayName,
				totalPoints,
				totalCost,
			}
		}) || []

	// 4. ФИЛЬТРАЦИЯ (Поиск)
	if (searchQuery) {
		allRows = allRows.filter(row =>
			// @ts-ignore (мы добавили displayName выше динамически)
			row.displayName.toLowerCase().includes(searchQuery)
		)
	}

	// 5. СОРТИРОВКА
	allRows.sort((a, b) => {
		let valA, valB

		if (sortKey === 'cost') {
			valA = a.totalCost
			valB = b.totalCost
		} else if (sortKey === 'rank') {
			// Сортировка по месту — это обратная сортировка по очкам
			// 1 место = Много очков.
			valA = a.totalPoints
			valB = b.totalPoints
			// Инвертируем логику для ранга: ASC (1, 2, 3) значит DESC по очкам
			if (sortDir === 'asc') return valB - valA
			return valA - valB
		} else if (sortKey === 'name') {
			// @ts-ignore
			valA = a.displayName
			// @ts-ignore
			valB = b.displayName
			// Для строк инвертируем логику сравнения, чтобы asc было А-Я
			if (sortDir === 'asc') return valA.localeCompare(valB)
			return valB.localeCompare(valA)
		} else {
			valA = a.totalPoints
			valB = b.totalPoints
		} // points default

		if (sortDir === 'asc') return valA - valB
		return valB - valA
	})

	// 6. ПАГИНАЦИЯ (Отрезаем кусочек)
	const totalItems = allRows.length
	const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
	const endIndex = startIndex + ITEMS_PER_PAGE
	const visibleRows = allRows.slice(startIndex, endIndex)

	// Вспомогательная функция для иконки места (теперь учитываем страницу)
	const getRankIcon = (index: number) => {
		const globalRank = startIndex + index // Реальное место в глобальном списке
		if (globalRank === 0 && sortKey === 'points' && sortDir === 'desc')
			return '🥇'
		if (globalRank === 1 && sortKey === 'points' && sortDir === 'desc')
			return '🥈'
		if (globalRank === 2 && sortKey === 'points' && sortDir === 'desc')
			return '🥉'
		return <span className='text-gray-500 font-mono'>#{globalRank + 1}</span>
	}

	// Хелпер для ссылок сортировки (сохраняет остальные параметры)
	const getSortLink = (key: string) => {
		const newDir = sortKey === key && sortDir === 'desc' ? 'asc' : 'desc'
		return `?tournamentId=${selectedTournamentId}&query=${searchQuery}&sort=${key}&dir=${newDir}`
	}

	return (
		<div className='pb-20 max-w-5xl mx-auto'>
			<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6'>
				<h1 className='text-2xl font-bold text-white'>Турнирная таблица</h1>
				<div className='w-full sm:w-auto'>
					<TournamentSelect
						tournaments={tournaments}
						activeId={selectedTournamentId}
					/>
				</div>
			</div>

			{/* КОНТРОЛЫ (Поиск и Пагинация) */}
			<PicksControls totalItems={totalItems} itemsPerPage={ITEMS_PER_PAGE} />

			<div className='overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl'>
				<table className='w-full text-left border-collapse'>
					<thead className='bg-gray-950/50 text-gray-400 uppercase text-xs tracking-wider'>
						<tr>
							<th className='p-5 font-semibold text-center w-20'>Место</th>

							<th className='p-5'>
								<Link
									href={getSortLink('name')}
									className='flex items-center gap-1 hover:text-white'
								>
									Участник{' '}
									{sortKey === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
								</Link>
							</th>

							<th className='p-5 text-right'>
								<div className='flex justify-end'>
									<Link
										href={getSortLink('cost')}
										className='flex items-center gap-1 hover:text-white'
									>
										Стоимость{' '}
										{sortKey === 'cost' && (sortDir === 'asc' ? '▲' : '▼')}
									</Link>
								</div>
							</th>

							<th className='p-5 text-right'>
								<div className='flex justify-end'>
									<Link
										href={getSortLink('points')}
										className='flex items-center gap-1 hover:text-white'
									>
										Очки{' '}
										{sortKey === 'points' && (sortDir === 'asc' ? '▲' : '▼')}
									</Link>
								</div>
							</th>

							<th className='p-5'></th>
						</tr>
					</thead>
					<tbody className='divide-y divide-gray-800'>
						{visibleRows.length === 0 && (
							<tr>
								<td colSpan={5} className='p-8 text-center text-gray-500'>
									Ничего не найдено
								</td>
							</tr>
						)}
						{visibleRows.map((user: any, idx) => (
							<tr
								key={user.id}
								className='hover:bg-gray-800/50 transition-colors group'
							>
								<td className='p-5 font-medium text-xl text-center'>
									{getRankIcon(idx)}
								</td>
								<td className='p-5'>
									<div className='flex items-center gap-3'>
										<div className='w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold shadow-lg flex-shrink-0'>
											{user.displayName[0].toUpperCase()}
										</div>
										<span className='font-medium text-white truncate max-w-[150px] sm:max-w-[200px] text-lg'>
											{user.displayName}
										</span>
									</div>
								</td>
								<td className='p-5 text-right text-gray-400 font-mono text-lg'>
									{user.totalCost}
								</td>
								<td className='p-5 text-right font-bold text-blue-400 text-2xl'>
									{user.totalPoints}
								</td>
								<td className='p-5 text-right'>
									<Link
										href={`/profile/${user.id}?tournamentId=${selectedTournamentId}`}
										className='inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-blue-400 bg-blue-400/10 rounded-full hover:bg-blue-400/20 transition-all opacity-0 group-hover:opacity-100'
									>
										Состав →
									</Link>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Пагинация внизу (для удобства на мобилках) */}
			<div className='mt-4 flex justify-center'>
				<PicksControls
					totalItems={totalItems}
					itemsPerPage={ITEMS_PER_PAGE}
					hideSearch={true}
				/>
			</div>
		</div>
	)
}
