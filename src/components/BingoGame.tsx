'use client'

import { saveBingoTicket, toggleBingoEvent } from '@/app/actions'
import { BingoEventType, BingoLeaderboardRow, BingoOption } from '@/types'
import { useState, useTransition } from 'react'

interface Props {
	tournamentId: number
	eventTypes: BingoEventType[]
	players: { id: number; name: string }[]
	options: BingoOption[]
	hasTicket: boolean
	mySelections: number[]
	leaderboard: BingoLeaderboardRow[]
	isAdmin?: boolean
}

export function BingoGame({
	tournamentId,
	eventTypes,
	players,
	options,
	hasTicket,
	mySelections,
	leaderboard,
	isAdmin,
}: Props) {
	// Состояние выбранных ячеек (пока билет не сохранен)
	const [selected, setSelected] = useState<number[]>([])
	const [isPending, startTransition] = useTransition()
	const [error, setError] = useState('')

	// Какие ID сейчас подсвечивать (если есть билет - то из базы, иначе - то что накликал)
	const activeIds = hasTicket ? mySelections : selected
	const count = activeIds.length

	// ЛОГИКА КЛИКА
	const handleCellClick = (optionId: number, isHappened: boolean) => {
		// 1. Режим Админа: меняем статус события
		if (isAdmin) {
			startTransition(async () => {
				await toggleBingoEvent(optionId, isHappened)
			})
			return
		}

		// 2. Если билет уже сохранен, кликать нельзя (только просмотр)
		if (hasTicket) return

		// 3. Обычный выбор
		if (selected.includes(optionId)) {
			// Если уже выбрано - убираем
			setSelected(prev => prev.filter(id => id !== optionId))
		} else {
			// Если не выбрано - добавляем (но не больше 15)
			if (selected.length >= 15) return
			setSelected(prev => [...prev, optionId])
		}
	}

	// СОХРАНЕНИЕ БИЛЕТА
	const handleSave = () => {
		if (selected.length !== 15) {
			setError('Нужно выбрать ровно 15 событий!')
			return
		}
		setError('') // сброс ошибок
		startTransition(async () => {
			const res = await saveBingoTicket(tournamentId, selected)
			if (res?.error) setError(res.error)
		})
	}

	return (
		<div className='space-y-8 p-4'>
			{/* --- БЛОК 1: ЛИДЕРБОРД --- */}
			<div className='bg-gray-900 border border-gray-800 rounded-xl p-6'>
				<h2 className='text-xl font-bold mb-4 flex items-center gap-2 text-white'>
					🏆 Гонка Бинго
				</h2>
				<div className='space-y-2'>
					{leaderboard.length === 0 && (
						<p className='text-gray-500'>Участников пока нет</p>
					)}
					{leaderboard.map((user, idx) => (
						<div
							key={idx}
							className='flex justify-between bg-gray-800/50 p-3 rounded'
						>
							<span className='text-gray-300'>
								{idx + 1}. {user.username || user.email}
							</span>
							<span className='font-bold text-white'>{user.score} / 15</span>
						</div>
					))}
				</div>
			</div>

			{/* --- БЛОК 2: СЕТКА (ТАБЛИЦА) --- */}
			<div>
				<div className='flex justify-between items-end mb-4'>
					<h1 className='text-2xl font-bold text-white'>
						{hasTicket ? 'Ваш Билет' : 'Сделайте выбор'}
					</h1>
					<div
						className={`text-xl font-mono font-bold ${
							count === 15 ? 'text-green-400' : 'text-blue-400'
						}`}
					>
						Выбрано: {count} / 15
					</div>
				</div>

				{error && (
					<div className='bg-red-900/50 text-red-200 p-3 rounded mb-4 text-center'>
						{error}
					</div>
				)}

				{/* АДАПТИВНАЯ ТАБЛИЦА */}
				<div className='overflow-x-auto border border-gray-700 rounded-lg shadow-xl'>
					<table className='w-full text-sm border-collapse'>
						{/* ЗАГОЛОВОК (ТИПЫ СОБЫТИЙ) */}
						<thead className='bg-gray-950 text-gray-300'>
							<tr>
								<th className='p-3 border-b border-gray-700 sticky left-0 bg-gray-950 z-20 min-w-[150px] text-left'>
									Игрок / Событие
								</th>
								{eventTypes.map(et => (
									<th
										key={et.id}
										className='p-2 border-b border-l border-gray-800 min-w-[80px] text-center font-normal'
									>
										{et.short_name}
									</th>
								))}
							</tr>
						</thead>

						{/* ТЕЛО (ИГРОКИ) */}
						<tbody className='bg-gray-900'>
							{players.map(player => (
								<tr
									key={player.id}
									className='hover:bg-gray-800/30 transition-colors'
								>
									{/* ИМЯ ИГРОКА (Закрепленная колонка) */}
									<td className='p-3 font-medium text-white border-b border-gray-800 sticky left-0 bg-gray-900 z-10'>
										{player.name}
									</td>

									{/* ЯЧЕЙКИ СОБЫТИЙ */}
									{eventTypes.map(et => {
										// Находим конкретную опцию на пересечении
										const opt = options.find(
											o =>
												o.player_id === player.id && o.event_type_id === et.id
										)

										// Если опции нет (ошибка данных), рисуем пустую клетку
										if (!opt)
											return (
												<td
													key={et.id}
													className='border-b border-l border-gray-800'
												></td>
											)

										const isSelected = activeIds.includes(opt.id)
										const isHappened = opt.is_happened

										// Определяем стили
										let cellClasses =
											'border-b border-l border-gray-800 text-center cursor-pointer h-12 relative '

										if (isHappened) {
											// Событие случилось (Зеленый)
											cellClasses +=
												'bg-green-600 hover:bg-green-500 text-white '
										} else if (isSelected) {
											// Выбрано пользователем (Синий)
											cellClasses += 'bg-blue-600 hover:bg-blue-500 text-white '
										} else {
											// Пустая ячейка
											cellClasses += 'hover:bg-gray-800 text-transparent '
										}

										// Если выбрано И случилось (Бинго!)
										if (isHappened && isSelected) {
											cellClasses += 'ring-2 ring-white inset-0 z-0 '
										}

										return (
											<td
												key={et.id}
												className={cellClasses}
												onClick={() => handleCellClick(opt.id, opt.is_happened)}
											>
												<div className='flex items-center justify-center w-full h-full'>
													{isHappened && <span>✓</span>}
													{!isHappened && isSelected && <span>●</span>}
												</div>
											</td>
										)
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* КНОПКА СОХРАНЕНИЯ */}
				{!hasTicket && (
					<button
						onClick={handleSave}
						disabled={count !== 15 || isPending}
						className='w-full mt-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-bold text-xl transition shadow-lg'
					>
						{isPending ? 'Сохранение...' : `Подтвердить Билет (${count}/15)`}
					</button>
				)}

				{/* Подсказка для Админа */}
				{isAdmin && (
					<div className='mt-4 p-4 bg-orange-900/20 border border-orange-800 rounded text-center text-orange-400 text-sm'>
						🔧 <b>РЕЖИМ АДМИНА ВКЛЮЧЕН</b>
						<br />
						Кликайте по ячейкам, чтобы отмечать события как "Случившиеся".
					</div>
				)}
			</div>
		</div>
	)
}
