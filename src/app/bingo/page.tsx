import { BingoGame } from '@/components/BingoGame'
import { BingoEventType, BingoLeaderboardRow, BingoOption } from '@/types'
import { createClient } from '@/utils/supabase/server'

// Отключаем кэш, чтобы видеть обновления в реальном времени
export const revalidate = 0

export default async function BingoPage({
	searchParams,
}: {
	searchParams: { admin?: string }
}) {
	const supabase = await createClient()

	// 1. Проверяем авторизацию
	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) {
		return <div className='p-8 text-center'>Сначала войдите в аккаунт</div>
	}

	// 2. Получаем активный турнир
	const { data: tournament } = await supabase
		.from('tournaments')
		.select('id')
		.eq('is_active', true)
		.single()

	if (!tournament) {
		return (
			<div className='p-8 text-center'>
				Нет активного турнира для игры в Бинго
			</div>
		)
	}

	// 3. Получаем заголовки (Типы событий)
	const { data: eventTypesData } = await supabase
		.from('bingo_event_types')
		.select('*')
		.order('id')

	const eventTypes = eventTypesData as BingoEventType[]

	// 4. Получаем игроков ТОЛЬКО этого турнира
	const { data: players } = await supabase
		.from('players')
		.select('id, name, baskets!inner(tournament_id)')
		.eq('baskets.tournament_id', tournament.id)
		.order('basket_id')
		.order('name')

	// 5. Получаем сетку статусов (какие события уже случились)
	const { data: optionsData } = await supabase
		.from('bingo_options')
		.select('*')
		.eq('tournament_id', tournament.id)

	const options = optionsData as BingoOption[]

	// 6. Проверяем, есть ли у пользователя уже сохраненный билет
	const { data: myTicket } = await supabase
		.from('bingo_tickets')
		.select('id, bingo_selections(option_id)')
		.eq('user_id', user.id)
		.eq('tournament_id', tournament.id)
		.single()

	const hasTicket = !!myTicket

	// Если билет есть, достаем ID выбранных опций
	const mySelections =
		myTicket?.bingo_selections.map((s: any) => s.option_id) || []

	// 7. Получаем таблицу лидеров (Гонку)
	const { data: leaderboardData } = await supabase
		.from('bingo_leaderboard')
		.select('*')
		.eq('tournament_id', tournament.id)
		.order('score', { ascending: false }) // Сначала у кого больше очков
		.order('last_event_time', { ascending: true }) // При равенстве - кто раньше собрал

	const leaderboard = leaderboardData as BingoLeaderboardRow[]

	// Проверка на админа через URL ?admin=true (для тестов)
	const isAdmin = searchParams?.admin === 'true'

	return (
		<div className='max-w-[1400px] mx-auto pb-20'>
			<BingoGame
				tournamentId={tournament.id}
				eventTypes={eventTypes || []}
				players={players || []}
				options={options || []}
				hasTicket={hasTicket}
				mySelections={mySelections}
				leaderboard={leaderboard || []}
				isAdmin={isAdmin}
			/>
		</div>
	)
}
