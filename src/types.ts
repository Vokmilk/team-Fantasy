// src/types.ts

// Тип для профиля (из таблицы profiles)
export interface Profile {
	id: string
	email: string | null
	username: string | null
	badges: string[] | null // jsonb обычно возвращается как массив или объект
}

// Тип игрока (упрощенный, для join запросов)
export interface PlayerBasic {
	name: string
	cost: number
	points: number
}

// Тип для выборки: Пик + данные игрока
// Обрати внимание: Supabase при join возвращает объект, если связь 1-к-1,
// или массив, если связь 1-к-многим. Но TypeScript часто путается.
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
		// Вложенная корзина. Supabase возвращает её как объект (если связь 1-к-1 или мы так считаем)
		// Но иногда TS думает что это массив, поэтому мы жестко типизируем как объект
		baskets: {
			name: string
			sort_order: number
		}
	}
}

export interface SelectionForBudget {
	players: {
		id: number
		basket_id: number
		cost: number
		// Нам не обязательно описывать baskets внутри, если мы их не используем в цикле
	}
}

export interface SelectionWithCost {
	player_id: number
	players: {
		cost: number
	}
}

// Тип для Игрока на главной странице
export interface PlayerDashboard {
	id: number
	name: string
	cost: number
	points: number
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
// ... старые типы ...

export interface BingoEventType {
  id: number;
  name: string;
  short_name: string;
}

export interface BingoOption {
  id: number;
  player_id: number;
  event_type_id: number;
  is_happened: boolean;
}

// Данные для построения сетки
export interface BingoGridData {
  eventTypes: BingoEventType[];
  players: { id: number; name: string }[];
  options: BingoOption[]; // Массив всех 100 опций
}

export interface BingoLeaderboardRow {
  user_id: string;
  username: string | null;
  email: string | null;
  score: number;
  last_event_time: string | null;
}