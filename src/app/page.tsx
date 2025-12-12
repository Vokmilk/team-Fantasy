import { DashboardManager } from '@/components/DashboardManager'
import { TournamentSelect } from '@/components/TournamentSelect'
import { BasketWithPlayers } from '@/types'
import { createClient } from '@/utils/supabase/server'

// Отключаем кэширование, чтобы данные (бюджет, состав) были всегда свежими
export const revalidate = 0

export default async function Dashboard({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
	const supabase = await createClient()

	// 1. Проверяем авторизацию
	const {
		data: { user },
	} = await supabase.auth.getUser()

	// Если не авторизован - middleware перекинет, но на всякий случай возвращаем null
	if (!user) return null

	// 2. Получаем параметры URL (Next.js 15)
	const resolvedParams = await searchParams
	const queryId = resolvedParams.tournamentId

	// 3. Получаем список турниров
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

	// 4. Определяем текущий турнир
	let currentTournament

	if (queryId) {
		// Если ID есть в URL — ищем конкретный турнир
		currentTournament = tournaments.find(t => t.id === Number(queryId))
	} else {
		// Если URL чист — ищем АКТИВНЫЙ, иначе берем самый последний созданный
		currentTournament = tournaments.find(t => t.is_active) || tournaments[0]
	}

	// Если вдруг турнир не найден (например, неверный ID в URL) — фоллбек на первый
	if (!currentTournament) currentTournament = tournaments[0]

	// 5. Получаем профиль пользователя (для отображения ника)
	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single()

	// 6. Получаем корзины и игроков для ЭТОГО турнира
	const { data: basketsData } = await supabase
		.from('baskets')
		.select('*, players(*)')
		.eq('tournament_id', currentTournament.id)
		.order('sort_order')

	const baskets = basketsData as unknown as BasketWithPlayers[]

	// 7. Получаем текущие пики пользователя в ЭТОМ турнире
	// Используем !inner, чтобы гарантировать, что пики относятся именно к этому турниру
	const { data: mySelectionsData } = await supabase
		.from('selections')
		.select('player_id, players!inner(baskets!inner(tournament_id))')
		.eq('user_id', user.id)
		.eq('players.baskets.tournament_id', currentTournament.id)

	// Нам нужны только ID игроков для инициализации стейта
	const initialPicksIds = mySelectionsData?.map(s => s.player_id) || []

	// Логика отображения статуса в заголовке
	// (Основная логика блокировки находится внутри DashboardManager, здесь только визуал)
	const isArchived = !currentTournament.is_active
	const isRegClosed = currentTournament.is_registration_closed

	return (
		<div className='space-y-6'>
			{/* Шапка страницы */}
			<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
				<div>
					<h1 className='text-xl font-bold text-white flex items-center gap-2 flex-wrap'>
						Кабинет
						{/* Плашки статусов */}
						{isArchived && (
							<span className='bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded border border-gray-700 uppercase tracking-wider'>
								Архив
							</span>
						)}
						{isRegClosed && (
							<span className='bg-red-900/30 text-red-400 border border-red-900 text-[10px] px-2 py-0.5 rounded uppercase tracking-wider'>
								Регистрация закрыта
							</span>
						)}
					</h1>
					<p className='text-sm text-gray-500 mt-1'>{currentTournament.name}</p>
				</div>

				{/* Селектор турниров */}
				<div className='w-full sm:w-auto'>
					<TournamentSelect
						tournaments={tournaments}
						activeId={currentTournament.id}
					/>
				</div>
			</div>

			{/* Основной компонент управления составом */}
			<DashboardManager
				userProfile={profile}
				tournament={currentTournament}
				baskets={baskets}
				initialPicksIds={initialPicksIds}
			/>
		</div>
	)
}
