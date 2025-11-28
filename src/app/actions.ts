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

	// 1. Создаем пользователя
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			// Передаем username в метаданные, чтобы триггер (если он есть) мог его подхватить
			data: { username },
		},
	})

	if (error) return { error: error.message }

	// 2. Если пользователь создан, обновляем таблицу profiles
	// (Это запасной вариант, если триггер в БД не настроен копировать username)
	if (data.user) {
		await supabase.from('profiles').update({ username }).eq('id', data.user.id)
	}

	revalidatePath('/', 'layout')
	redirect('/')
}

export async function login(formData: FormData) {
	const supabase = await createClient()
	const loginInput = formData.get('login') as string // Может быть email или username
	const password = formData.get('password') as string

	let email = loginInput

	// Если введен не email (нет собачки), пробуем найти email по username
	if (!loginInput.includes('@')) {
		// Вызываем RPC функцию, которую мы создали в SQL (get_email_by_username)
		const { data: foundEmail } = await supabase.rpc('get_email_by_username', {
			uname: loginInput,
		})
		if (!foundEmail) return { error: 'Пользователь с таким ником не найден' }
		email = foundEmail
	}

	const { error } = await supabase.auth.signInWithPassword({ email, password })

	if (error) return { error: error.message }

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
  
  const { data: { user } } = await supabase.auth.getUser()
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