import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import { NextResponse } from 'next/server'

// Настройки для Vercel
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Максимальное время работы (сек)

export async function GET(request: Request) {
	try {
		// 1. БЕЗОПАСНОСТЬ
		const authHeader = request.headers.get('authorization')
		if (
			authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
			process.env.NODE_ENV === 'production'
		) {
			return new NextResponse('Unauthorized', { status: 401 })
		}

		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!
		)

		// 2. ПОЛУЧАЕМ АКТИВНЫЕ ТУРНИРЫ (где включен парсинг)
		const { data: tournaments } = await supabase
			.from('tournaments')
			.select('*')
			.eq('is_parsing', true)
			.not('slug', 'is', null)

		if (!tournaments || tournaments.length === 0) {
			return NextResponse.json({ message: 'No tournaments for parsing' })
		}

		let totalProcessed = 0
		const logs: string[] = []

		for (const tour of tournaments) {
			// Формируем ссылку на список
			const baseUrlString = `https://mediagame.by/tournament/${tour.slug}`
			const listUrlObj = new URL(baseUrlString)
			listUrlObj.searchParams.set('tab', 'results')

			const LIST_URL = listUrlObj.toString()
			logs.push(`Processing: ${tour.name}`)

			// Скачиваем список игр
			const response = await fetch(LIST_URL)
			if (!response.ok) {
				logs.push(`Error fetching list: ${response.status}`)
				continue
			}
			const html = await response.text()
			const $ = cheerio.load(html)

			// 3. СОБИРАЕМ ID ИГР СО СТРАНИЦЫ
			const gameIdsOnSite: number[] = []
			$('a[href*="game="]').each((_, el) => {
				const href = $(el).attr('href')
				if (href) {
					const match = href.match(/game=(\d+)/)
					if (match) gameIdsOnSite.push(parseInt(match[1]))
				}
			})

			// Сортируем и убираем дубликаты
			let uniqueGameIds = [...new Set(gameIdsOnSite)].sort((a, b) => a - b)

			// Фильтр по "Первой игре" (если задан в админке)
			if (tour.start_game_id) {
				uniqueGameIds = uniqueGameIds.filter(id => id >= tour.start_game_id)
			}

			if (uniqueGameIds.length === 0) {
				logs.push(`No games found matching criteria.`)
				continue
			}

			// 4. ПРОВЕРКА: Что уже есть в базе?
			const { data: existingGames } = await supabase
				.from('games')
				.select('id')
				.in('id', uniqueGameIds)

			const existingIds = new Set(existingGames?.map(g => g.id))
			const newGameIds = uniqueGameIds.filter(id => !existingIds.has(id))

			if (newGameIds.length === 0) {
				logs.push(`All games up to date.`)
				continue
			}

			// 5. ПАРСИНГ НОВЫХ ИГР (Батч из 3 шт)
			const batch = newGameIds.slice(0, 3)
			logs.push(`Parsing games: ${batch.join(', ')}`)

			for (const gameId of batch) {
				// Формируем ссылку на игру
				const gameUrlObj = new URL(baseUrlString)
				gameUrlObj.searchParams.set('tab', 'results')
				gameUrlObj.searchParams.set('game', gameId.toString())

				const GAME_URL = gameUrlObj.toString()
				console.log(GAME_URL)

				const gameRes = await fetch(GAME_URL)

				console.log(gameRes)

				if (!gameRes.ok) {
					logs.push(`Failed to fetch game ${gameId}`)
					continue
				}
				const gameHtml = await gameRes.text()
				const $$ = cheerio.load(gameHtml)

				// --- ПАРСИНГ ДЕТАЛЕЙ ---
				let winner = 'unknown'
				const bodyText = $$('body').text().toLowerCase()
				// Проверка победителя (текст может варьироваться)
				if (bodyText.includes('победа красных')) winner = 'red'
				if (
					bodyText.includes('победа чёрных') ||
					bodyText.includes('победа черных') ||
					bodyText.includes('победа мафии')
				)
					winner = 'black'

				const playerStats: any[] = []

				// Ищем строки в таблице (используем класс dataTable)
				const rows = $$('table.dataTable tbody tr')

				rows.each((_, row) => {
					const cols = $$(row).find('td')
					if (cols.length < 4) return

					// --- КОЛОНКА 1: ИМЯ ---
					// Ищем внутри strong или просто текст
					let name = $$(cols[1]).find('strong').text().trim()
					if (!name) name = $$(cols[1]).text().trim()

					// --- КОЛОНКА 2: РОЛЬ ---
					// "Мафия", "Дон", "Мирный", "Шериф"
					let role = 'civilian' // по умолчанию мирный
					const roleText = $$(cols[2]).text().trim().toLowerCase()

					if (roleText.includes('дон')) role = 'don'
					else if (roleText.includes('шериф')) role = 'sheriff'
					else if (roleText.includes('мафия')) role = 'mafia'

					// --- КОЛОНКА 3: БАЛЛЫ ---
					// Берем из data-sort="6.25"
					const pointsAttr = $$(cols[3]).attr('data-sort')
					let points = pointsAttr ? parseFloat(pointsAttr) : 0
					// Фоллбек на текст, если атрибута нет
					if (!pointsAttr) {
						points = parseFloat(
							$$(cols[3]).text().trim().replace(',', '.') || '0'
						)
					}

					// --- КОЛОНКА 13: ДИСЦ. ШТРАФЫ ---
					// (Индексы начинаются с 0, значит 14-я колонка это индекс 13)
					const foulsAttr = $$(cols[13]).attr('data-sort')
					const fouls = foulsAttr ? parseFloat(foulsAttr) : 0

					if (name) {
						playerStats.push({
							game_id: gameId,
							player_name: name,
							role,
							points,
							fouls,
						})
					}
				})

				// --- СОХРАНЕНИЕ ---
				if (playerStats.length > 0) {
					// 1. Сохраняем Игру
					await supabase.from('games').insert({
						id: gameId,
						tournament_id: tour.id,
						// Порядковый номер (1, 2, 3...) относительно старта
						game_number: gameId - (tour.start_game_id || gameId) + 1,
						winner_team: winner,
					})

					// 2. Сохраняем Игроков
					const { error } = await supabase
						.from('game_player_stats')
						.insert(playerStats)

					if (error) {
						logs.push(`Error DB stats: ${error.message}`)
					} else {
						totalProcessed++
					}
				} else {
					logs.push(
						`Warning: No players parsed for game ${gameId} (Check HTML structure)`
					)
				}
			}
		}

		return NextResponse.json({
			success: true,
			processed: totalProcessed,
			logs,
		})
	} catch (error: any) {
		console.error('Cron Error:', error)
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
