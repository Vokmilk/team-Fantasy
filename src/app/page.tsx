import { SelectionCard } from '@/components/SelectionCard'
import { StatsHeader } from '@/components/StatsHeader'
import { BasketWithPlayers, SelectionWithCost } from '@/types'
import { createClient } from '@/utils/supabase/server'

// Отключаем кэширование, чтобы видеть актуальный бюджет сразу
export const revalidate = 0

export default async function Dashboard() {
	const supabase = await createClient()

	// 1. Проверяем пользователя
	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return null

	// 2. Получаем активный турнир
	const { data: tournament } = await supabase
		.from('tournaments')
		.select('*')
		.eq('is_active', true)
		.single()

	// Если нет активного турнира (все в архиве)
	if (!tournament) {
		return (
			<div className='flex flex-col items-center justify-center min-h-[50vh] space-y-4'>
				<h1 className='text-2xl font-bold text-gray-400'>
					Нет активных турниров
				</h1>
				<p className='text-gray-500'>
					Сейчас межсезонье. Посмотрите результаты прошлых игр в таблице.
				</p>
			</div>
		)
	}

	// 3. Получаем данные профиля (для отображения ника)
	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single()

	// 4. Получаем корзины и игроков ТОЛЬКО для активного турнира
	const { data: basketsData } = await supabase
		.from('baskets')
		.select('*, players(*)')
		.eq('tournament_id', tournament.id)
		.order('sort_order')

	const baskets = basketsData as unknown as BasketWithPlayers[]

	// 5. Получаем пики пользователя (ФИЛЬТРАЦИЯ ПО ТУРНИРУ)
	// Используем !inner, чтобы отсеять пики из старых турниров
	const { data: mySelectionsData } = await supabase
		.from('selections')
		.select('player_id, players!inner(cost, baskets!inner(tournament_id))')
		.eq('user_id', user.id)
		.eq('players.baskets.tournament_id', tournament.id)

	const mySelections = mySelectionsData as unknown as SelectionWithCost[]

	// 6. Расчет бюджета
	const spent = mySelections?.reduce((acc, s) => acc + s.players.cost, 0) || 0
	const remaining = tournament.budget - spent

	return (
		<div className='space-y-6'>
			{/* Шапка с бюджетом */}
			<StatsHeader
				username={profile?.username || user.email}
				budget={tournament.budget}
				spent={spent}
				remaining={remaining}
			/>

			<div className='text-center mb-4'>
				<h2 className='text-xl font-bold text-blue-400'>{tournament.name}</h2>
				<p className='text-sm text-gray-500'>
					Соберите команду, уложившись в бюджет
				</p>
			</div>

			{/* Сетка корзин */}
			<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6'>
				{baskets?.map(basket => (
					<div
						key={basket.id}
						className='bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col shadow-lg'
					>
						<div className='bg-gray-800/50 p-4 border-b border-gray-700 flex justify-between items-center'>
							<h3 className='font-bold text-lg text-gray-200'>{basket.name}</h3>
							<span className='text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded'>
								Выбрать: {basket.allowed_picks}
							</span>
						</div>

						<div className='p-2 space-y-2 flex-1  scrollbar-thin scrollbar-thumb-gray-700'>
							{basket.players
								.sort((a, b) => b.cost - a.cost)
								.map(player => {
									const isSelected = mySelections?.some(
										s => s.player_id === player.id
									)
									// Кнопка недоступна, если денег мало И игрок еще не выбран
									const isDisabled = !isSelected && remaining < player.cost

									return (
										<SelectionCard
											key={player.id}
											player={player}
											isSelected={isSelected}
											isDisabled={isDisabled}
											tournamentId={tournament.id}
											basketId={basket.id}
										/>
									)
								})}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
