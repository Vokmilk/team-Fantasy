import { DashboardManager } from '@/components/DashboardManager' // Импортируем новый компонент
import { TournamentSelect } from '@/components/TournamentSelect'
import { BasketWithPlayers } from '@/types'
import { createClient } from '@/utils/supabase/server'

export const revalidate = 0

export default async function Dashboard({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
	const supabase = await createClient()

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return null

	const resolvedParams = await searchParams
	const queryId = resolvedParams.tournamentId

	const { data: tournaments } = await supabase
		.from('tournaments')
		.select('*')
		.order('id', { ascending: false })

	if (!tournaments || tournaments.length === 0)
		return <div className='p-8 text-center text-gray-500'>Нет турниров</div>

	let currentTournament
	if (queryId) {
		currentTournament = tournaments.find(t => t.id === Number(queryId))
	} else {
		currentTournament = tournaments.find(t => t.is_active) || tournaments[0]
	}
	if (!currentTournament) currentTournament = tournaments[0]

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single()

	const { data: basketsData } = await supabase
		.from('baskets')
		.select('*, players(*)')
		.eq('tournament_id', currentTournament.id)
		.order('sort_order')

	const baskets = basketsData as unknown as BasketWithPlayers[]

	const { data: mySelectionsData } = await supabase
		.from('selections')
		.select('player_id, players!inner(baskets!inner(tournament_id))')
		.eq('user_id', user.id)
		.eq('players.baskets.tournament_id', currentTournament.id)

	// Нам нужны только ID для инициализации
	const initialPicksIds = mySelectionsData?.map(s => s.player_id) || []

	return (
		<div className='space-y-6'>
			<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
				<div>
					<h1 className='text-xl font-bold text-white flex items-center gap-2'>
						Кабинет
						{!currentTournament.is_active && (
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

			{/* Подключаем Менеджер */}
			<DashboardManager
				userProfile={profile}
				tournament={currentTournament}
				baskets={baskets}
				initialPicksIds={initialPicksIds}
			/>
		</div>
	)
}
