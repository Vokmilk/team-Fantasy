import chromium from '@sparticuz/chromium'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'

// Пытаемся запросить максимум времени (на Hobby тарифе это все равно часто 10-15 сек)
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
	console.log('1. Cron job started') // ЛОГ 1

	try {
		const authHeader = request.headers.get('authorization')
		if (
			authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
			process.env.NODE_ENV === 'production'
		) {
			return new NextResponse('Unauthorized', { status: 401 })
		}

		console.log('2. Launching Browser...') // ЛОГ 2
		let browser
		if (process.env.NODE_ENV === 'production') {
			// Настройка для Vercel
			browser = await puppeteer.launch({
				args: chromium.args,
				defaultViewport: { width: 1920, height: 1080 },
				executablePath: await chromium.executablePath(),
				headless: true,
			})
		} else {
			return NextResponse.json({ message: 'Skipping local run for now' })
		}

		const page = await browser.newPage()
		console.log('3. Navigating to page...') // ЛОГ 3

		// Уменьшаем таймаут загрузки, чтобы быстрее падать если сайт висит
		await page.goto('https://mediagame.by/rating', {
			waitUntil: 'domcontentloaded',
			timeout: 15000,
		})

		console.log('4. Selecting 100 items...') // ЛОГ 4
		const selectSelector = 'select[name="DataTables_Table_0_length"]'
		await page.waitForSelector(selectSelector, { timeout: 5000 })
		await page.select(selectSelector, '100')

		console.log('5. Waiting for table update...') // ЛОГ 5
		// Ждем обновления таблицы
		await page.waitForFunction(
			() => {
				const rows = document.querySelectorAll('#DataTables_Table_0 tbody tr')
				return rows.length > 25
			},
			{ timeout: 8000 }
		)

		console.log('6. Parsing data...') // ЛОГ 6
		const players = await page.evaluate(() => {
			const rows = Array.from(
				document.querySelectorAll('#DataTables_Table_0 tbody tr')
			)
			return rows
				.map(row => {
					const cols = row.querySelectorAll('td')
					if (cols.length < 5) return null
					// any типы для простых функций внутри evaluate
					const cleanNum = (text: any) => parseInt(text?.trim() || '0')
					const cleanFloat = (text: any) => parseFloat(text?.trim() || '0')
					const clean = (text: any) => text?.trim() || ''

					const rank = cleanNum(cols[0].innerText)
					const name = clean(cols[1].innerText)
					const rating = cleanNum(cols[2].innerText)
					const games = cleanNum(cols[3].innerText)
					const wins = cleanNum(cols[4].innerText)
					const winRate = cleanFloat(cols[5].innerText.replace('%', ''))

					if (!rank || !name) return null

					return {
						rank,
						player_name: name,
						rating,
						games_played: games,
						wins,
						win_rate: winRate,
						updated_at: new Date().toISOString(),
					}
				})
				.filter(p => p !== null && p.rank <= 100)
		})

		await browser.close()
		console.log(`7. Done. Parsed ${players.length} players`) // ЛОГ 7

		if (players.length > 0) {
			console.log('8. Saving to Supabase...') // ЛОГ 8
			const supabaseAdmin = createClient(
				process.env.NEXT_PUBLIC_SUPABASE_URL!,
				process.env.SUPABASE_SERVICE_ROLE_KEY!
			)

			const { error } = await supabaseAdmin
				.from('external_ratings')
				.upsert(players, { onConflict: 'rank' })

			if (error) throw error
			console.log('9. Success!')
			return NextResponse.json({ success: true, count: players.length })
		}

		return NextResponse.json({ success: false, message: 'Empty table' })
	} catch (error: any) {
		console.error('CRON ERROR:', error) // ЛОГ ОШИБКИ
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
