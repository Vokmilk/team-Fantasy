import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
	try {
		// 1. Проверка Cron Secret
		const authHeader = request.headers.get('authorization')
		if (
			authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
			process.env.NODE_ENV === 'production'
		) {
			return new NextResponse('Unauthorized', { status: 401 })
		}

		const TARGET_URL = 'https://mediagame.by/rating'
		const USER_AGENT =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

		console.log('1. Starting Handshake...')

		// Шаг 1: Получаем куки (рукопожатие)
		const response1 = await fetch(TARGET_URL, {
			headers: { 'User-Agent': USER_AGENT },
		})

		// Собираем куки
		const rawCookies = response1.headers.getSetCookie()
		const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ')
		console.log('Cookies obtained:', cookieHeader ? 'Yes' : 'No')

		// Шаг 2: Запрашиваем ПОЛНУЮ таблицу (length=300 с запасом)
		console.log('2. Fetching full table...')
		const response2 = await fetch(
			`${TARGET_URL}?DataTables_Table_0_length=300`,
			{
				headers: {
					'User-Agent': USER_AGENT,
					Cookie: cookieHeader,
					Accept:
						'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				},
			}
		)

		const html = await response2.text()
		const $ = cheerio.load(html)

		// --- ПАРСИНГ ---
		const rows = $('tbody tr')
		const players: any[] = []

		rows.each((i, row) => {
			const cols = $(row).find('td')
			if (cols.length < 5) return

			const cleanNum = (val: any) => parseInt(val?.trim() || '0')
			const cleanFloat = (val: any) =>
				parseFloat(val?.replace('%', '').trim() || '0')

			// Имя
			let name = $(cols[1]).find('a').text().trim()
			if (!name) name = $(cols[1]).text().trim()

			// Данные
			const rank = cleanNum($(cols[0]).text())
			const rating = $(cols[2]).attr('data-sort')
				? cleanNum($(cols[2]).attr('data-sort'))
				: cleanNum($(cols[2]).text())
			const games = $(cols[3]).attr('data-sort')
				? cleanNum($(cols[3]).attr('data-sort'))
				: cleanNum($(cols[3]).text())
			const wins = $(cols[4]).attr('data-sort')
				? cleanNum($(cols[4]).attr('data-sort'))
				: cleanNum($(cols[4]).text())
			const winRate = $(cols[5]).attr('data-sort')
				? cleanFloat($(cols[5]).attr('data-sort'))
				: cleanFloat($(cols[5]).text())

			// Валидация: Добавляем только если есть место и имя
			if (rank > 0 && name) {
				players.push({
					rank,
					player_name: name,
					rating,
					games_played: games,
					wins,
					win_rate: winRate,
					updated_at: new Date().toISOString(),
				})
			}
		})

		console.log(`3. Valid players parsed: ${players.length}`)

		// --- СОХРАНЕНИЕ ---
		if (players.length > 0) {
			console.log(`4. Saving all ${players.length} players to DB...`)

			const supabaseAdmin = createClient(
				process.env.NEXT_PUBLIC_SUPABASE_URL!,
				process.env.SUPABASE_SERVICE_ROLE_KEY!
			)

			// Upsert сохранит ВСЕХ (мы убрали .slice)
			const { error } = await supabaseAdmin
				.from('external_ratings')
				.upsert(players, { onConflict: 'rank' })

			if (error) {
				console.error('DB Error:', error)
				throw error
			}
			// --- НОВОЕ: 2. Синхронизируем цены в турнирах ---
			console.log('5. Syncing tournament player costs...')
			const { error: syncError } = await supabaseAdmin.rpc('sync_player_costs')

			if (syncError) {
				console.error('Sync Error:', syncError)
				// Не падаем с ошибкой, так как рейтинг уже обновлен, просто логируем
			} else {
				console.log('Costs synced successfully.')
			}

			return NextResponse.json({
				success: true,
				count: players.length,
				message: `Saved ${players.length} players to database and sync`,
			})
		}

		return NextResponse.json({
			success: false,
			message: 'No players found',
			pageTitle: $('title').text().trim(),
		})
	} catch (error: any) {
		console.error('Script Error:', error)
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
