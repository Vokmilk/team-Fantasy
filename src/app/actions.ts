'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { SelectionForBudget } from '@/types'

// --- AUTHENTICATION ---

export async function signup(formData: FormData) {
	const supabase = await createClient()
	const email = formData.get('email') as string
	const password = formData.get('password') as string
	const username = formData.get('username') as string

	// Проверка: занят ли такой username?
	const { data: existingUser } = await supabase
		.from('profiles')
		.select('id')
		.eq('username', username)
		.single()

	if (existingUser) {
		return { error: 'Пользователь с таким никнеймом уже существует' }
	}

	const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: { username }, // В метаданные
			emailRedirectTo: `${siteUrl}/auth/callback`,
		},
	})

	if (error) return { error: error.message }

	// ВАЖНО: Явно записываем username в таблицу profiles
	if (data.user) {
		await supabase
			.from('profiles')
			.update({ username: username })
			.eq('id', data.user.id)
	}

	return { success: true }
}

export async function login(formData: FormData) {
	const supabase = await createClient()

	const loginInput = formData.get('login') as string
	const password = formData.get('password') as string

	let email = loginInput

	// Если это не email (нет собачки), ищем email по никнейму
	if (!loginInput.includes('@')) {
		const { data: foundEmail, error } = await supabase.rpc(
			'get_email_by_username',
			{ uname: loginInput }
		)

		if (error || !foundEmail) {
			return { error: 'Пользователь с таким логином не найден' }
		}
		email = foundEmail
	}

	const { error } = await supabase.auth.signInWithPassword({ email, password })

	if (error) {
		return { error: 'Неверные данные для входа' }
	}

	revalidatePath('/', 'layout')
	redirect('/')
}

export async function signOut() {
	const supabase = await createClient()
	await supabase.auth.signOut()
	redirect('/login')
}

// --- PASSWORD RESET (ВОССТАНОВЛЕННЫЕ ФУНКЦИИ) ---

export async function resetPassword(email: string) {
	const supabase = await createClient()
	const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${siteUrl}/auth/callback?next=/update-password`,
	})

	return { error: error?.message, success: !error }
}

export async function updatePassword(formData: FormData) {
	const supabase = await createClient()
	const password = formData.get('password') as string

	const { error } = await supabase.auth.updateUser({
		password: password,
	})

	if (error) {
		return { error: error.message }
	}

	revalidatePath('/', 'layout')
	redirect('/')
}

// --- FANTASY LOGIC (ТУРНИРЫ И БЮДЖЕТ) ---

export async function saveSelection(
	tournamentId: number,
	basketId: number,
	playerId: number
) {
	const supabase = await createClient()

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) throw new Error('Unauthorized')

	// 1. Получаем бюджет турнира
	const { data: tournament } = await supabase
		.from('tournaments')
		.select('budget')
		.eq('id', tournamentId)
		.single()

	if (!tournament) throw new Error('Tournament not found')

	// 2. Получаем стоимость нового игрока
	const { data: newPlayer } = await supabase
		.from('players')
		.select('cost')
		.eq('id', playerId)
		.single()

	// 3. Считаем текущие расходы, ИСКЛЮЧАЯ текущую корзину (так как мы заменяем игрока в ней)
	// Нам нужно найти все пики юзера в этом турнире
	const { data: allPicksData } = await supabase // Переименуем переменную в allPicksData
		.from('selections')
		.select('players!inner(id, basket_id, cost, baskets!inner(tournament_id))')
		.eq('user_id', user.id)
		.eq('players.baskets.tournament_id', tournamentId)

	// ЯВНОЕ ПРИВЕДЕНИЕ ТИПА:
	// Мы говорим: "Данные, которые пришли, точно соответствуют этому интерфейсу"
	const allPicks = allPicksData as unknown as SelectionForBudget[]

	let currentSpent = 0

	// Теперь TS знает, что p.players - это объект, и ошибки исчезнут
	allPicks?.forEach(p => {
		if (p.players.basket_id !== basketId) {
			currentSpent += p.players.cost
		}
	})

	// 4. Проверяем бюджет
	const newTotal = currentSpent + (newPlayer?.cost || 0)
	if (newTotal > tournament.budget) {
		throw new Error(
			`Превышен бюджет! Доступно: ${
				tournament.budget - currentSpent
			}, Цена игрока: ${newPlayer?.cost}`
		)
	}

	// 5. Логика замены: Удаляем старый выбор из этой корзины (если есть)
	// Получаем ID игроков, которые принадлежат этой корзине
	const { data: basketPlayers } = await supabase
		.from('players')
		.select('id')
		.eq('basket_id', basketId)

	const basketPlayerIds = basketPlayers?.map(p => p.id) || []

	if (basketPlayerIds.length > 0) {
		// Удаляем выбор, если player_id входит в список игроков этой корзины
		await supabase
			.from('selections')
			.delete()
			.eq('user_id', user.id)
			.in('player_id', basketPlayerIds)
	}

	// 6. Сохраняем новый выбор
	const { error } = await supabase.from('selections').insert({
		user_id: user.id,
		player_id: playerId,
	})

	if (error) throw new Error(error.message)

	revalidatePath('/')
	revalidatePath('/picks')
	revalidatePath('/stats')
}

// ... импорты

// --- BINGO LOGIC ---

export async function saveBingoTicket(
	tournamentId: number,
	selectedOptionIds: number[]
) {
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return { error: 'Unauthorized' }

	// Валидация
	if (selectedOptionIds.length !== 15) {
		return { error: 'Необходимо выбрать ровно 15 событий!' }
	}

	// 1. Создаем билет
	const { data: ticket, error: ticketError } = await supabase
		.from('bingo_tickets')
		.insert({ user_id: user.id, tournament_id: tournamentId })
		.select()
		.single()

	if (ticketError) {
		if (ticketError.code === '23505')
			return { error: 'Вы уже создали билет для этого турнира' }
		return { error: ticketError.message }
	}

	// 2. Добавляем опции
	const selections = selectedOptionIds.map(optId => ({
		ticket_id: ticket.id,
		option_id: optId,
	}))

	const { error: selError } = await supabase
		.from('bingo_selections')
		.insert(selections)

	if (selError) return { error: selError.message }

	revalidatePath('/bingo')
	return { success: true }
}

// --- ADMIN BINGO (Для тестов) ---
export async function toggleBingoEvent(
	optionId: number,
	currentState: boolean
) {
	const supabase = await createClient()

	// В реальном проекте тут нужна проверка на админа!
	await supabase
		.from('bingo_options')
		.update({
			is_happened: !currentState,
			happened_at: !currentState ? new Date().toISOString() : null,
		})
		.eq('id', optionId)

	revalidatePath('/bingo')
}

export async function removeSelection(playerId: number) {
	const supabase = await createClient()

	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) throw new Error('Unauthorized')

	// Удаляем конкретный выбор
	const { error } = await supabase
		.from('selections')
		.delete()
		.eq('user_id', user.id)
		.eq('player_id', playerId)

	if (error) throw new Error(error.message)

	revalidatePath('/')
	revalidatePath('/picks')
	revalidatePath('/stats')
}

export async function saveUserPicks(tournamentId: number, playerIds: number[]) {
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) throw new Error('Unauthorized')

	// 1. Получаем данные о турнире и выбранных игроках из БД (не доверяем клиенту)
	const { data: tournament } = await supabase
		.from('tournaments')
		.select('budget')
		.eq('id', tournamentId)
		.single()

	if (!tournament) throw new Error('Турнир не найден')

	// Получаем реальные данные игроков (цену и корзину)
	const { data: players } = await supabase
		.from('players')
		.select('id, cost, basket_id')
		.in('id', playerIds)

	if (!players || players.length !== playerIds.length) {
		throw new Error('Ошибка данных игроков')
	}

	// 2. ВАЛИДАЦИЯ
	// А. Проверка количества (должно быть 4)
	if (players.length !== 4) {
		throw new Error(`Нужно выбрать ровно 4 игрока! Выбрано: ${players.length}`)
	}

	// Б. Проверка уникальности корзин (1 игрок из каждой корзины)
	const baskets = new Set(players.map(p => p.basket_id))
	if (baskets.size !== 4) {
		throw new Error('Нужно выбрать по одному игроку из каждой корзины!')
	}

	// В. Проверка бюджета
	const totalCost = players.reduce((sum, p) => sum + p.cost, 0)
	if (totalCost > tournament.budget) {
		throw new Error(`Бюджет превышен! (${totalCost} / ${tournament.budget})`)
	}

	// 3. СОХРАНЕНИЕ
	// Нам нужно удалить старые пики ЭТОГО турнира и вставить новые.

	// Получаем ID всех корзин этого турнира, чтобы найти старые пики
	const { data: tournamentBaskets } = await supabase
		.from('baskets')
		.select('id')
		.eq('tournament_id', tournamentId)

	const basketIds = tournamentBaskets?.map(b => b.id) || []

	// Удаляем старые выборы, которые ссылаются на игроков из этих корзин
	// (Это немного сложно в SQL через Supabase JS, поэтому делаем в два шага:
	// находим игроков турнира -> удаляем selections с ними)
	const { data: playersInTournament } = await supabase
		.from('players')
		.select('id')
		.in('basket_id', basketIds)

	const idsToDelete = playersInTournament?.map(p => p.id) || []

	if (idsToDelete.length > 0) {
		await supabase
			.from('selections')
			.delete()
			.eq('user_id', user.id)
			.in('player_id', idsToDelete)
	}

	// Вставляем новые
	const newSelections = playerIds.map(id => ({
		user_id: user.id,
		player_id: id,
	}))

	const { error } = await supabase.from('selections').insert(newSelections)
	if (error) throw new Error(error.message)

	revalidatePath('/')
	revalidatePath('/picks')
	return { success: true }
}
