'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

type PlayerSelection = {
	playerId: number
	cost: number
	basketId: number
}

// Новая Server Action для сохранения всех выборов
export async function saveSelections(
	userId: string, // Передаем user ID из Client Component
	tournamentId: number,
	newSelections: PlayerSelection[]
) {
	const supabase = await createClient()

	// 1. Проверка бюджета (на стороне сервера)
	const { data: tournament } = await supabase
		.from('tournaments')
		.select('budget')
		.eq('id', tournamentId)
		.single()

	if (!tournament) {
		throw new Error('Tournament not found')
	}

	const newTotalSpent = newSelections.reduce((acc, s) => acc + s.cost, 0)

	if (newTotalSpent > tournament.budget) {
		throw new Error(
			`Превышен бюджет! Доступно: ${tournament.budget}, Общие расходы: ${newTotalSpent}`
		)
	}

	// 2. Проверка, что в каждой корзине только один игрок
	const basketCounts = newSelections.reduce((acc, s) => {
		acc[s.basketId] = (acc[s.basketId] || 0) + 1
		return acc
	}, {} as Record<number, number>)

	for (const basketId in basketCounts) {
		const basketInfo = await supabase
			.from('baskets')
			.select('allowed_picks')
			.eq('id', Number(basketId))
			.single()

		if (
			basketInfo?.data &&
			basketCounts[basketId] > basketInfo.data.allowed_picks
		) {
			throw new Error(
				`Корзина #${basketId} превышает лимит выбора (${basketInfo.data.allowed_picks})`
			)
		}
	}

	// 3. Атомарное сохранение: Удаляем все старые пики и вставляем новые

	// a) Получаем ID игроков всех корзин текущего турнира
	const { data: playersInTournament } = await supabase
		.from('players')
		.select('id')
		.eq('baskets.tournament_id', tournamentId)
		.in('baskets.tournament_id', [tournamentId]) // Убедимся, что фильтр работает

	const allPlayerIdsInTournament = playersInTournament?.map(p => p.id) || []

	// b) Удаляем ВСЕ старые выборы пользователя в этом турнире
	if (allPlayerIdsInTournament.length > 0) {
		const { error: deleteError } = await supabase
			.from('selections')
			.delete()
			.eq('user_id', userId)
			.in('player_id', allPlayerIdsInTournament)

		if (deleteError) {
			console.error('Ошибка при удалении старых выборов:', deleteError)
			throw new Error('Ошибка при очистке старых выборов.')
		}
	}

	// c) Формируем данные для вставки
	const picksToInsert = newSelections.map(s => ({
		user_id: userId,
		player_id: s.playerId,
	}))

	// d) Вставляем новые выборы
	const { error: insertError } = await supabase
		.from('selections')
		.insert(picksToInsert)

	if (insertError) {
		console.error('Ошибка при вставке новых выборов:', insertError)
		throw new Error(insertError.message)
	}

	// 4. Перевалидация кэша для обновления данных на других страницах
	revalidatePath('/dashboard') // Изменено с '/'
	revalidatePath('/picks')
	revalidatePath('/stats')
}

// Удаляем старую функцию saveSelection, так как она больше не нужна
// export async function saveSelection(...) {}
