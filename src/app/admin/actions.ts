'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// 1. Создаем "Админского" клиента с сервисным ключом
// Это позволяет игнорировать правила RLS и писать в базу
const getAdminClient = () => {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY

	if (!url || !key) {
		throw new Error('Supabase URL or Service Role Key is missing in .env')
	}

	return createClient(url, key)
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

// Проверка: Заблокирован ли турнир?
async function checkTournamentLocked(tournamentId: number) {
	const supabase = getAdminClient()
	const { data, error } = await supabase
		.from('tournaments')
		.select('is_registration_closed')
		.eq('id', tournamentId)
		.single()

	if (error || !data) throw new Error('Турнир не найден')

	if (data.is_registration_closed) {
		throw new Error(
			'ОШИБКА: Регистрация закрыта! Нельзя менять состав турнира. Снимите галочку в настройках.'
		)
	}
}

// Пересчет бюджета: (Сумма рейтингов / Кол-во) * 4
async function recalculateBudget(tournamentId: number) {
	const supabase = getAdminClient()

	// Получаем всех игроков этого турнира
	const { data: players } = await supabase
		.from('players')
		.select('cost, baskets!inner(tournament_id)')
		.eq('baskets.tournament_id', tournamentId)

	if (!players || players.length === 0) return

	const totalCost = players.reduce((sum, p) => sum + p.cost, 0)
	const averageCost = totalCost / players.length
	const newBudget = Math.round(averageCost * 4)

	await supabase
		.from('tournaments')
		.update({ budget: newBudget })
		.eq('id', tournamentId)
}

// --- ОСНОВНЫЕ ДЕЙСТВИЯ (ACTIONS) ---

// 1. Создание нового турнира
export async function createTournament(
	name: string,
	budget: number,
	slug: string
) {
	const supabase = getAdminClient()

	const { data: tour, error } = await supabase
		.from('tournaments')
		.insert({
			name,
			budget,
			slug,
			is_active: false,
			is_parsing: false,
			is_registration_closed: false,
		})
		.select()
		.single()

	if (error) return { error: error.message }

	// Создаем 4 корзины
	const baskets = [1, 2, 3, 4].map(i => ({
		tournament_id: tour.id,
		name: `Корзина ${i}`,
		sort_order: i,
		allowed_picks: 1,
	}))

	const { error: basketError } = await supabase.from('baskets').insert(baskets)
	if (basketError) return { error: basketError.message }

	revalidatePath('/admin')
	return { success: true, id: tour.id }
}

// 2. Обновление настроек турнира
export async function updateTournament(
  id: number, 
  name: string, 
  isActive: boolean, 
  slug: string, 
  isParsing: boolean,
  isRegistrationClosed: boolean,
  startGameId: number, // <--- НОВОЕ
  totalGames: number   // <--- НОВОЕ
) {
  const supabase = getAdminClient()
  
  if (isActive) {
    await supabase.from('tournaments').update({ is_active: false }).neq('id', 0)
  }

  const { error } = await supabase
    .from('tournaments')
    .update({ 
        name, 
        is_active: isActive,
        slug,
        is_parsing: isParsing,
        is_registration_closed: isRegistrationClosed,
        start_game_id: startGameId, // <--- Сохраняем
        total_games: totalGames     // <--- Сохраняем
    })
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/admin')
  revalidatePath('/')
  return { success: true }
}
// 3. Массовое сохранение состава (Используется в TournamentManager)
export async function saveTournamentRoster(
	tournamentId: number,
	playersData: { name: string; cost: number; basket_id: number }[]
) {
	// Сначала проверяем блокировку!
	await checkTournamentLocked(tournamentId)

	const supabase = getAdminClient()

	// Находим ID корзин этого турнира
	const { data: baskets } = await supabase
		.from('baskets')
		.select('id')
		.eq('tournament_id', tournamentId)

	const basketIds = baskets?.map(b => b.id) || []

	// Очищаем старый состав (удаляем игроков в этих корзинах)
	if (basketIds.length > 0) {
		await supabase.from('players').delete().in('basket_id', basketIds)
	}

	// Вставляем новый состав
	if (playersData.length > 0) {
		const { error } = await supabase.from('players').insert(playersData)
		if (error) return { error: error.message }
	}

	// Пересчитываем бюджет (оптимизированно, без лишнего запроса, т.к. данные у нас на руках)
	if (playersData.length > 0) {
		const totalCost = playersData.reduce((sum, p) => sum + p.cost, 0)
		const avg = totalCost / playersData.length
		const newBudget = Math.round(avg * 4)

		await supabase
			.from('tournaments')
			.update({ budget: newBudget })
			.eq('id', tournamentId)
	}

	revalidatePath('/admin/tournament/[id]', 'page')
	revalidatePath('/')
	return { success: true }
}

// 4. Добавление одного игрока (если нужно точечно)
export async function addPlayerToTournament(
	basketId: number,
	tournamentId: number,
	name: string,
	rating: number
) {
	await checkTournamentLocked(tournamentId)

	const supabase = getAdminClient()
	const { error } = await supabase.from('players').insert({
		basket_id: basketId,
		name: name,
		cost: rating, // Цена равна рейтингу
		points: 0,
	})

	if (error) return { error: error.message }

	await recalculateBudget(tournamentId)

	revalidatePath('/admin/tournament/[id]', 'page')
	return { success: true }
}

// 5. Удаление одного игрока
export async function removePlayerFromTournament(
	playerId: number,
	tournamentId: number
) {
	await checkTournamentLocked(tournamentId)

	const supabase = getAdminClient()
	const { error } = await supabase.from('players').delete().eq('id', playerId)

	if (error) return { error: error.message }

	await recalculateBudget(tournamentId)

	revalidatePath('/admin/tournament/[id]', 'page')
	return { success: true }
}
