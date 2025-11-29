'use client'

import { saveTournamentRoster } from '@/app/admin/action'
import { useMemo, useState } from 'react'

interface Player {
	name: string
	cost: number // Рейтинг
	rank?: number // Место в общем топе
	id?: number // ID если уже в базе (не обязательно для новой логики)
}

interface Props {
	tournament: any
	baskets: any[] // Ожидаем массив корзин, отсортированный по sort_order
	externalRatings: any[]
}

export function TournamentManager({
	tournament,
	baskets,
	externalRatings,
}: Props) {
	const [searchTerm, setSearchTerm] = useState('')
	const [isSaving, setIsSaving] = useState(false)
	const [hasChanges, setHasChanges] = useState(false)

	// Инициализируем состояние текущими игроками из базы
	// Собираем всех игроков из всех корзин в один плоский список
	const initialPlayers = useMemo(() => {
		const list: Player[] = []
		baskets.forEach(b => {
			if (b.players) {
				b.players.forEach((p: any) => list.push({ name: p.name, cost: p.cost }))
			}
		})
		return list
	}, [baskets])

	const [selectedPlayers, setSelectedPlayers] =
		useState<Player[]>(initialPlayers)

	// --- ЛОГИКА АВТО-РАСПРЕДЕЛЕНИЯ ---
	// 1. Сортируем всех выбранных по цене (рейтингу) убывания
	// 2. Делим на кол-во корзин (4)
	const distributedBaskets = useMemo(() => {
		// Сортировка: Дорогие сверху
		const sorted = [...selectedPlayers].sort((a, b) => b.cost - a.cost)

		// Рассчитываем размер одной корзины (желательно поровну, но если не делится - хвост последней)
		// Обычно в фентези строго по 10 человек. Но сделаем динамически.
		const playersPerBasket = Math.ceil(sorted.length / 4) || 1

		return baskets.map((basket, index) => {
			const start = index * playersPerBasket
			const end = start + playersPerBasket
			return {
				...basket,
				players: sorted.slice(start, end),
			}
		})
	}, [selectedPlayers, baskets])

	// --- ДЕЙСТВИЯ ---

	const handleAdd = (externalPlayer: any) => {
		// Проверка на дубликаты
		if (selectedPlayers.some(p => p.name === externalPlayer.player_name)) return

		const newPlayer: Player = {
			name: externalPlayer.player_name,
			cost: externalPlayer.rating,
			rank: externalPlayer.rank,
		}

		setSelectedPlayers(prev => [...prev, newPlayer])
		setHasChanges(true)
	}

	const handleRemove = (nameToRemove: string) => {
		setSelectedPlayers(prev => prev.filter(p => p.name !== nameToRemove))
		setHasChanges(true)
	}

	const handleReset = () => {
		if (!confirm('Вы уверены? Это очистит весь состав турнира.')) return
		setSelectedPlayers([])
		setHasChanges(true)
	}

	const handleSaveChanges = async () => {
		setIsSaving(true)

		// Подготовка данных для сервера
		// Нам нужно "собрать" плоский массив, но проставив каждому игроку basket_id
		const payload: { name: string; cost: number; basket_id: number }[] = []

		distributedBaskets.forEach(basketWithPlayers => {
			basketWithPlayers.players.forEach((p: Player) => {
				payload.push({
					name: p.name,
					cost: p.cost,
					basket_id: basketWithPlayers.id,
				})
			})
		})

		const res = await saveTournamentRoster(tournament.id, payload)

		setIsSaving(false)
		if (res?.error) {
			alert('Ошибка: ' + res.error)
		} else {
			setHasChanges(false)
			alert('Состав и бюджет успешно обновлены!')
		}
	}

	// Фильтр для левой колонки (исключаем уже добавленных)
	const filteredExternal = externalRatings.filter(
		p =>
			p.player_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
			!selectedPlayers.some(sp => sp.name === p.player_name)
	)

	// Расчетный бюджет (прогноз)
	const projectedBudget = useMemo(() => {
		if (selectedPlayers.length === 0) return 0
		const total = selectedPlayers.reduce((acc, p) => acc + p.cost, 0)
		return Math.round((total / selectedPlayers.length) * 4)
	}, [selectedPlayers])

	return (
		<div className='space-y-6'>
			{/* ПАНЕЛЬ УПРАВЛЕНИЯ (STICKY) */}
			<div className='bg-gray-900 border border-gray-800 p-4 rounded-xl sticky top-20 z-30 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4'>
				<div className='flex items-center gap-6'>
					<div>
						<div className='text-xs text-gray-400 uppercase'>Игроков</div>
						<div
							className={`text-xl font-bold ${
								selectedPlayers.length === 40
									? 'text-green-400'
									: 'text-yellow-400'
							}`}
						>
							{selectedPlayers.length}{' '}
							<span className='text-sm text-gray-500 font-normal'>/ 40</span>
						</div>
					</div>
					<div>
						<div className='text-xs text-gray-400 uppercase'>
							Расчетный бюджет
						</div>
						<div className='text-xl font-bold text-blue-400'>
							{projectedBudget}
						</div>
					</div>
				</div>

				<div className='flex gap-3'>
					<button
						onClick={handleReset}
						className='px-4 py-2 text-red-400 hover:bg-red-900/20 rounded transition text-sm font-bold'
					>
						Сбросить все
					</button>
					<button
						onClick={handleSaveChanges}
						disabled={!hasChanges || isSaving}
						className={`px-6 py-2 rounded font-bold text-lg transition shadow-lg flex items-center gap-2
                    ${
											hasChanges
												? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20'
												: 'bg-gray-800 text-gray-500 cursor-not-allowed'
										}`}
					>
						{isSaving ? 'Сохранение...' : 'Сохранить изменения'}
						{hasChanges && (
							<span className='w-2 h-2 rounded-full bg-white animate-pulse'></span>
						)}
					</button>
				</div>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
				{/* ЛЕВАЯ КОЛОНКА: МАГАЗИН */}
				<div className='lg:col-span-1 bg-gray-900 border border-gray-800 rounded-xl p-4 h-[calc(100vh-250px)] flex flex-col'>
					<h3 className='font-bold mb-4 text-gray-200'>Доступные игроки</h3>
					<input
						placeholder='Поиск...'
						className='input-dark w-full mb-4'
						value={searchTerm}
						onChange={e => setSearchTerm(e.target.value)}
					/>

					<div className='flex-1 overflow-y-auto space-y-1 pr-2 no-scrollbar'>
						{filteredExternal.map(p => (
							<button
								key={p.rank}
								onClick={() => handleAdd(p)}
								className='w-full flex justify-between items-center p-2 bg-gray-800/50 hover:bg-gray-800 rounded border border-transparent hover:border-gray-600 transition group text-left'
							>
								<div>
									<div className='text-sm font-bold text-gray-200'>
										{p.player_name}
									</div>
									<div className='text-xs text-gray-500'>
										#{p.rank} | Rating: {p.rating}
									</div>
								</div>
								<span className='text-green-500 text-xl font-bold opacity-0 group-hover:opacity-100 transition'>
									+
								</span>
							</button>
						))}
					</div>
				</div>

				{/* ПРАВАЯ КОЛОНКА: РАСПРЕДЕЛЕНИЕ */}
				<div className='lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-fit'>
					{distributedBaskets.map((basket, i) => (
						<div key={basket.id} className='flex flex-col gap-2'>
							{/* Заголовок корзины */}
							<div className='bg-gray-800 p-3 rounded-lg border border-gray-700 text-center'>
								<div className='font-bold text-white'>{basket.name}</div>
								<div className='text-xs text-gray-400'>
									{basket.players.length} чел.
								</div>
							</div>

							{/* Список игроков в корзине */}
							<div className='space-y-1'>
								{basket.players.map((player: Player) => (
									<div
										key={player.name}
										className='bg-gray-900 p-2 rounded border border-gray-800 flex justify-between items-center group hover:border-red-900/50 transition'
									>
										<div className='truncate pr-2'>
											<div className='text-sm font-medium text-gray-300 truncate'>
												{player.name}
											</div>
											<div className='text-[10px] text-yellow-600 font-mono'>
												{player.cost}
											</div>
										</div>
										<button
											onClick={() => handleRemove(player.name)}
											className='text-gray-600 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition'
										>
											×
										</button>
									</div>
								))}
								{/* Заглушки для пустых мест, если хотим визуально видеть 10 слотов */}
								{Array.from({
									length: Math.max(0, 10 - basket.players.length),
								}).map((_, idx) => (
									<div
										key={idx}
										className='h-10 border border-gray-800/50 border-dashed rounded bg-gray-900/20'
									></div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
