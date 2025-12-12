'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// -----------------------------------------------------------------------------
// AUTHENTICATION
// -----------------------------------------------------------------------------

export async function signup(formData: FormData) {
	const supabase = await createClient()

	const email = formData.get('email') as string
	const password = formData.get('password') as string
	const username = formData.get('username') as string

	// 1. Проверяем, свободен ли никнейм
	const { data: existingUser } = await supabase
		.from('profiles')
		.select('id')
		.ilike('username', username)
		.single()

	if (existingUser) {
		return { error: 'Пользователь с таким никнеймом уже существует' }
	}

	// 2. Ссылка для подтверждения
	const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

	// 3. Регистрация
	const { error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			// Записываем username в метаданные.
			// SQL-триггер handle_new_user автоматически перенесет его в таблицу profiles.
			data: {
				username: username,
				full_name: username,
			},
			emailRedirectTo: `${siteUrl}/auth/callback`,
		},
	})

	if (error) {
		return { error: error.message }
	}

	return { success: true }
}

export async function login(formData: FormData) {
	const supabase = await createClient()

	const loginInput = formData.get('login') as string
	const password = formData.get('password') as string

	let email = loginInput

	// 1. Если введен не email (нет собачки), ищем email по никнейму через RPC
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

	// 2. Входим
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

// -----------------------------------------------------------------------------
// FANTASY LOGIC (USER SIDE)
// -----------------------------------------------------------------------------

export async function saveUserPicks(tournamentId: number, playerIds: number[]) {
	const supabase = await createClient()

	// 1. Авторизация
	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) throw new Error('Unauthorized')

	// 2. Получаем данные турнира (Бюджет + Статусы)
	const { data: tournament } = await supabase
		.from('tournaments')
		.select('budget, is_registration_closed, is_active')
		.eq('id', tournamentId)
		.single()

	if (!tournament) throw new Error('Турнир не найден')

	// ПРОВЕРКА БЕЗОПАСНОСТИ: Закрыта ли регистрация?
	if (tournament.is_registration_closed) {
		throw new Error('Регистрация завершена. Изменения не сохранены.')
	}
	if (!tournament.is_active) {
		throw new Error('Турнир находится в архиве.')
	}

	// 3. Получаем данные выбранных игроков из БД (цену и корзину)
	// Важно брать цену с сервера, а не верить клиенту
	const { data: players } = await supabase
		.from('players')
		.select('id, cost, basket_id')
		.in('id', playerIds)

	if (!players || players.length !== playerIds.length) {
		throw new Error('Ошибка данных игроков (кто-то не найден)')
	}

	// 4. ВАЛИДАЦИЯ
	// А. Количество
	if (players.length !== 4) {
		throw new Error(`Нужно выбрать ровно 4 игрока! Выбрано: ${players.length}`)
	}

	// Б. Уникальность корзин (1 игрок из каждой корзины)
	const baskets = new Set(players.map(p => p.basket_id))
	if (baskets.size !== 4) {
		throw new Error('Нужно выбрать по одному игроку из каждой корзины!')
	}

	// В. Бюджет
	const totalCost = players.reduce((sum, p) => sum + p.cost, 0)
	if (totalCost > tournament.budget) {
		throw new Error(`Бюджет превышен! (${totalCost} / ${tournament.budget})`)
	}

	// 5. СОХРАНЕНИЕ
	// Нам нужно перезаписать выбор для ЭТОГО турнира.
	// Самый надежный способ: найти все корзины этого турнира -> удалить пики игроков из этих корзин -> вставить новые.

	const { data: tournamentBaskets } = await supabase
		.from('baskets')
		.select('id')
		.eq('tournament_id', tournamentId)

	const basketIds = tournamentBaskets?.map(b => b.id) || []

	// Находим ID всех игроков, которые участвуют в этом турнире (чтобы удалить старые пики)
	const { data: playersInTournament } = await supabase
		.from('players')
		.select('id')
		.in('basket_id', basketIds)

	const idsToDelete = playersInTournament?.map(p => p.id) || []

	if (idsToDelete.length > 0) {
		// Удаляем старые пики пользователя в этом турнире
		await supabase
			.from('selections')
			.delete()
			.eq('user_id', user.id)
			.in('player_id', idsToDelete)
	}

	// Вставляем новые пики
	const newSelections = playerIds.map(id => ({
		user_id: user.id,
		player_id: id,
	}))

	const { error } = await supabase.from('selections').insert(newSelections)

	if (error) throw new Error(error.message)

	// Обновляем кэш страниц
	revalidatePath('/')
	revalidatePath('/picks')

	return { success: true }
}

// Функции для Бинго (если используются)
export async function saveBingoTicket(
	tournamentId: number,
	selectedOptionIds: number[]
) {
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()
	if (!user) return { error: 'Unauthorized' }

	if (selectedOptionIds.length !== 15) {
		return { error: 'Необходимо выбрать ровно 15 событий!' }
	}

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

// Админская функция для Бинго (если нужно)
export async function toggleBingoEvent(
	optionId: number,
	currentState: boolean
) {
	const supabase = await createClient()
	// Тут в реальном проекте стоит проверить роль админа
	await supabase
		.from('bingo_options')
		.update({
			is_happened: !currentState,
			happened_at: !currentState ? new Date().toISOString() : null,
		})
		.eq('id', optionId)

	revalidatePath('/bingo')
}
