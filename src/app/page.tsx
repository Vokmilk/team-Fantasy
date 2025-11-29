import { SelectionCard } from '@/components/SelectionCard'

import { StatsHeader } from '@/components/StatsHeader'

import { TournamentSelect } from '@/components/TournamentSelect'

import { BasketWithPlayers, SelectionWithCost } from '@/types'

import { createClient } from '@/utils/supabase/server'

export const revalidate = 0

// Добавляем searchParams для чтения URL

export default async function Dashboard({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
	const supabase = await createClient()

	// 1. Проверяем пользователя

	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (!user) return null

	// 2. Получаем параметры URL (Next.js 15)

	const resolvedParams = await searchParams

	const queryId = resolvedParams.tournamentId

	// 3. Получаем ВСЕ турниры (чтобы заполнить селектор)

	const { data: tournaments } = await supabase

		.from('tournaments')

		.select('*')

		.order('id', { ascending: false })

	if (!tournaments || tournaments.length === 0) {
		return (
			<div className='p-8 text-center text-gray-500'>
				Нет доступных турниров
			</div>
		)
	}

	// 4. Определяем, какой турнир показывать

	let currentTournament

	if (queryId) {
		// Если в URL есть ID — ищем его

		currentTournament = tournaments.find(t => t.id === Number(queryId))
	} else {
		// Если URL чист — ищем АКТИВНЫЙ, либо берем самый последний

		currentTournament = tournaments.find(t => t.is_active) || tournaments[0]
	}

	// Если вдруг ID из URL не найден

	if (!currentTournament) currentTournament = tournaments[0]

	// Флаг: Если турнир архивный - запрещаем редактирование

	const isReadOnly = !currentTournament.is_active

	// 5. Получаем профиль

	const { data: profile } = await supabase

		.from('profiles')

		.select('*')

		.eq('id', user.id)

		.single()

	// 6. Получаем корзины и игроков ВЫБРАННОГО турнира

	const { data: basketsData } = await supabase

		.from('baskets')

		.select('*, players(*)')

		.eq('tournament_id', currentTournament.id)

		.order('sort_order')

	const baskets = basketsData as unknown as BasketWithPlayers[]

	// 7. Получаем пики пользователя для ВЫБРАННОГО турнира

	const { data: mySelectionsData } = await supabase

		.from('selections')

		.select('player_id, players!inner(cost, baskets!inner(tournament_id))')

		.eq('user_id', user.id)

		.eq('players.baskets.tournament_id', currentTournament.id)

	const mySelections = mySelectionsData as unknown as SelectionWithCost[]

	// 8. Расчет бюджета

	const spent = mySelections?.reduce((acc, s) => acc + s.players.cost, 0) || 0

	const remaining = currentTournament.budget - spent

	return (
		<div className='space-y-6 pb-20'>
			{/* Шапка с выбором турнира */}

			<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
				<div>
					<h1 className='text-xl font-bold text-white flex items-center gap-2'>
						Кабинет
						{isReadOnly && (
							<span className='bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded border border-gray-700 uppercase tracking-wider'>
								Архив
							</span>
						)}
					</h1>

					<p className='text-sm text-gray-500'>{currentTournament.name}</p>
				</div>

				<div className='w-full sm:w-auto'>
					<TournamentSelect
						tournaments={tournaments}
						activeId={currentTournament.id}
					/>
				</div>
			</div>

			{/* Инфо о бюджете */}

			<StatsHeader
				username={profile?.username || user.email}
				budget={currentTournament.budget}
				spent={spent}
				remaining={remaining}
			/>

			{/* Сетка корзин */}

			<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6'>
				{baskets?.map(basket => (
					<div
						key={basket.id}
						className='bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col shadow-lg'
					>
						<div className='bg-gray-800/50 p-3 border-b border-gray-700 flex justify-between items-center'>
							<h3 className='font-bold text-base text-gray-200'>
								{basket.name}
							</h3>

							<span className='text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded uppercase font-bold tracking-wider'>
								Выбрать: {basket.allowed_picks}
							</span>
						</div>

						<div className='p-1 space-y-1 flex-1'>
							{basket.players

								.sort((a, b) => b.cost - a.cost)

								.map(player => {
									const isSelected = mySelections?.some(
										s => s.player_id === player.id
									)

									// Кнопка недоступна, если:

									// 1. Турнир архивный (isReadOnly)

									// 2. ИЛИ денег мало И игрок не выбран

									const isDisabled =
										isReadOnly || (!isSelected && remaining < player.cost)

									return (
										<SelectionCard
											key={player.id}
											player={player}
											isSelected={isSelected}
											isDisabled={isDisabled}
											tournamentId={currentTournament.id}
											basketId={basket.id}
										/>
									)
								})}
						</div>
					</div>
				))}

				{baskets?.length === 0 && (
					<div className='col-span-full text-center py-10 text-gray-500'>
						В этом турнире нет корзин
					</div>
				)}
			</div>
		</div>
	)
}
