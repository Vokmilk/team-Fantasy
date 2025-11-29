// src/types.ts

// --- Базовые типы ---

export type Tournament = {
	id: number
	name: string
	is_active: boolean
	budget: number
}

export interface Profile {
	id: string
	email: string | null
	username: string | null
	badges: string[] | null // jsonb обычно возвращается как массив или объект
	is_admin?: boolean
}

export type Player = {
	id: number
	name: string
	cost: number
	basket_id: number // ID корзины, к которой относится игрок
	// ... другие поля игрока
}

// Тип для Корзины, внутри которой массив игроков
export interface BasketWithPlayers {
	id: number
	name: string
	allowed_picks: number
	sort_order: number
	// Тут Важно: мы говорим, что players - это массив объектов PlayerDashboard
	players: PlayerDashboard[]
}

// --- Типы для выборов и бюджета ---

// 1. Тип для игрока на главной странице (Dashboard)
export interface PlayerDashboard {
	id: number
	name: string
	cost: number
	points: number
}

/**
 * 2. ТИП ДЛЯ ВЫБОРОВ С ДАННЫМИ О СТОИМОСТИ И КОРЗИНЕ (ДЛЯ DashboardClient)
 *
 * ИСПРАВЛЕНО: Добавлен basket_id во вложенный объект baskets.
 * Это нужно, чтобы понять, к какой корзине относится выбор игрока (для state).
 */
export interface SelectionWithCost {
	player_id: number
	players: {
		cost: number
		// Supabase возвращает вложенный объект для basket_id через players!inner(baskets!inner)
		baskets: {
			tournament_id: number
			basket_id: number // <<< КЛЮЧЕВОЕ ДОБАВЛЕНИЕ
		}
	}
}

// 3. Тип, используемый в Server Action для проверки бюджета
export interface SelectionForBudget {
	players: {
		id: number
		basket_id: number
		cost: number
		// Нам не обязательно описывать baskets внутри, если мы их не используем в цикле
	}
}

/**
 * 4. ТИП ДЛЯ КЛИЕНТСКОГО СОСТОЯНИЯ (DashboardClient)
 *
 * Новый тип, который используется для временного хранения выборов пользователя.
 */
export type PlayerSelection = {
	playerId: number
	cost: number
	basketId: number
}

// --- Статистика и результаты ---

// Тип игрока (упрощенный, для join запросов)
export interface PlayerBasic {
	name: string
	cost: number
	points: number
}

// Тип для выборки: Пик + данные игрока
export interface SelectionWithPlayer {
	user_id: string
	players: PlayerBasic // Мы знаем, что тут будет объект, а не массив
}

// Тип для строки таблицы результатов (то, что мы собираем в map)
export interface LeaderboardRow extends Profile {
	totalPoints: number
	totalCost: number
}

export interface SelectionWithDetails {
	players: {
		name: string
		cost: number
		points: number
		// Вложенная корзина.
		baskets: {
			name: string
			sort_order: number
		}
	}
}

// --- Bingo Типы ---

export interface BingoEventType {
	id: number
	name: string
	short_name: string
}

export interface BingoOption {
	id: number
	player_id: number
	event_type_id: number
	is_happened: boolean
}

// Данные для построения сетки
export interface BingoGridData {
	eventTypes: BingoEventType[]
	players: { id: number; name: string }[]
	options: BingoOption[] // Массив всех 100 опций
}

export interface BingoLeaderboardRow {
	user_id: string
	username: string | null
	email: string | null
	score: number
	last_event_time: string | null
}
