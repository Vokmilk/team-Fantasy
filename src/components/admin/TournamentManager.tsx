'use client'

import { saveTournamentRoster, updateTournament } from '@/app/admin/actions'
import { useMemo, useState } from 'react'

interface Player {
	name: string
	cost: number
	rank?: number
	id?: number
	basket_id?: number
}

interface Props {
	tournament: any
	baskets: any[]
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

	// Настройки "Опасной зоны"
	const [isRegClosed, setIsRegClosed] = useState(
		tournament.is_registration_closed
	)
	const [showDangerModal, setShowDangerModal] = useState(false)

	// Стейты для Парсинга (чтобы обновлять Preview мгновенно)
	const [slug, setSlug] = useState(tournament.slug || '')
	const [startGameId, setStartGameId] = useState(tournament.start_game_id || '')

	// --- ИНИЦИАЛИЗАЦИЯ ИГРОКОВ (Логика состава) ---
	const initialPlayers = useMemo(() => {
		const list: Player[] = []
		baskets.forEach(b => {
			if (b.players) {
				b.players.forEach((p: any) =>
					list.push({ name: p.name, cost: p.cost, basket_id: b.id })
				)
			}
		})
		return list
	}, [baskets])

	const [selectedPlayers, setSelectedPlayers] =
		useState<Player[]>(initialPlayers)

	// --- АВТО-РАСПРЕДЕЛЕНИЕ ПО КОРЗИНАМ ---
	const distributedBaskets = useMemo(() => {
		const sorted = [...selectedPlayers].sort((a, b) => b.cost - a.cost)
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

	// --- РАСЧЕТ БЮДЖЕТА ---
	const projectedBudget = useMemo(() => {
		if (selectedPlayers.length === 0) return 0
		const total = selectedPlayers.reduce((acc, p) => acc + p.cost, 0)
		return Math.round((total / selectedPlayers.length) * 4)
	}, [selectedPlayers])

	// --- ДЕЙСТВИЯ С ИГРОКАМИ ---
	const handleAdd = (externalPlayer: any) => {
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
		if (!confirm('Вы уверены? Это очистит весь состав.')) return
		setSelectedPlayers([])
		setHasChanges(true)
	}

	const handleSaveRoster = async () => {
		setIsSaving(true)
		const payload: any[] = []
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
		if (res?.error) alert('Ошибка: ' + res.error)
		else {
			setHasChanges(false)
			alert(`Состав обновлен! Новый бюджет: ${projectedBudget}`)
		}
	}

	// --- СОХРАНЕНИЕ НАСТРОЕК ---
	const handleSaveSettings = async (formData: FormData) => {
		const name = formData.get('name') as string

		// Данные парсинга берем из формы
		const formSlug = formData.get('slug') as string
		const formStartId = Number(formData.get('start_game_id')) || 0
		const formTotalGames = Number(formData.get('total_games')) || 40

		const active = formData.get('is_active') === 'on'
		const parsing = formData.get('is_parsing') === 'on'

		await updateTournament(
			tournament.id,
			name,
			active,
			formSlug,
			parsing,
			isRegClosed,
			formStartId,
			formTotalGames
		)
		alert('Настройки сохранены!')
	}

	const handleRegToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.checked
		if (!newValue) {
			e.preventDefault()
			setShowDangerModal(true)
		} else {
			setIsRegClosed(true)
		}
	}

	const confirmUnlock = () => {
		setIsRegClosed(false)
		setShowDangerModal(false)
	}

	const filteredExternal = externalRatings.filter(
		p =>
			p.player_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
			!selectedPlayers.some(sp => sp.name === p.player_name)
	)

	// --- ГЕНЕРАЦИЯ ПРЕДПРОСМОТРА ССЫЛОК ---
	// 1. Ссылка на список (куда пойдет Крон)
	const previewListUrl = slug
		? `https://mediagame.by/tournament/${slug}?tab=results`
		: 'Введите slug...'

	// 2. Ссылка на первую игру (для проверки ID)
	const previewGameUrl =
		slug && startGameId
			? `https://mediagame.by/tournament/${slug}?tab=results&game=${startGameId}`
			: null

	return (
		<div className='space-y-8 relative pb-20'>
			{/* МОДАЛКА ОПАСНОЙ ЗОНЫ */}
			{showDangerModal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'>
					<div className='bg-gray-900 border-2 border-red-600 rounded-2xl max-w-md w-full p-6 shadow-2xl'>
						<h3 className='text-2xl font-bold text-red-500 mb-4'>
							⚠️ ОПАСНАЯ ЗОНА
						</h3>
						<p className='text-gray-300 mb-6'>
							Вы открываете регистрацию. Изменение состава может сломать бюджеты
							пользователей.
						</p>
						<div className='flex gap-3 justify-end'>
							<button
								onClick={() => setShowDangerModal(false)}
								className='px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-white'
							>
								Отмена
							</button>
							<button
								onClick={confirmUnlock}
								className='px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded'
							>
								Открыть
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ФОРМА НАСТРОЕК */}
			<form
				action={handleSaveSettings}
				className='bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg space-y-6'
			>
				{/* Верхний блок: Имя и Статус */}
				<div className='flex justify-between items-center border-b border-gray-800 pb-4'>
					<h3 className='text-lg font-bold text-white'>Настройки Турнира</h3>
					<label className='flex items-center gap-2 cursor-pointer bg-gray-950 px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500 transition'>
						<input
							name='is_active'
							type='checkbox'
							defaultChecked={tournament.is_active}
							className='w-4 h-4 accent-green-500'
						/>
						<span className='text-sm font-medium text-gray-200'>
							Отображать на сайте (Активный)
						</span>
					</label>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
					{/* Левая колонка: Основное */}
					<div className='space-y-4'>
						<div className='flex gap-4'>
							<div className='flex-1'>
								<label className='text-gray-400 text-xs uppercase font-bold mb-1 block'>
									Название
								</label>
								<input
									name='name'
									defaultValue={tournament.name}
									className='input-dark w-full'
									required
								/>
							</div>
							<div className='w-32'>
								<label className='text-blue-400 text-xs uppercase font-bold mb-1 block'>
									Авто-Бюджет
								</label>
								<input
									value={projectedBudget || tournament.budget}
									disabled
									className='bg-gray-800 border border-gray-700 text-white rounded p-2 w-full font-mono font-bold opacity-70 cursor-not-allowed text-center'
								/>
							</div>
						</div>

						{/* Блок Регистрации */}
						<div
							className={`p-4 rounded-lg border transition-colors ${
								isRegClosed
									? 'bg-red-900/10 border-red-800'
									: 'bg-green-900/10 border-green-800'
							}`}
						>
							<label className='flex items-center gap-3 cursor-pointer'>
								<input
									type='checkbox'
									checked={isRegClosed}
									onChange={handleRegToggle}
									className='w-5 h-5 accent-red-500'
								/>
								<span
									className={`font-bold ${
										isRegClosed ? 'text-red-400' : 'text-green-400'
									}`}
								>
									{isRegClosed
										? '🔒 РЕГИСТРАЦИЯ ЗАВЕРШЕНА'
										: '🟢 Регистрация открыта'}
								</span>
							</label>
							<p className='text-[10px] text-gray-500 mt-2 pl-8'>
								{isRegClosed
									? 'Состав заблокирован.'
									: 'Пользователи могут собирать команды.'}
							</p>
						</div>
					</div>

					{/* Правая колонка: Настройки Парсинга */}
					<div className='bg-gray-950/50 p-4 rounded-lg border border-gray-800 flex flex-col justify-between'>
						<div>
							<div className='flex justify-between items-start mb-3'>
								<label className='text-yellow-500 text-xs uppercase font-bold'>
									Настройки Парсинга
								</label>
								<label className='flex items-center gap-2 cursor-pointer'>
									<input
										name='is_parsing'
										type='checkbox'
										defaultChecked={tournament.is_parsing}
										className='w-4 h-4 accent-yellow-500'
									/>
									<span className='text-xs font-bold text-yellow-500'>
										Авто-сбор (ВКЛ)
									</span>
								</label>
							</div>

							{/* Slug */}
							<div className='mb-3'>
								<label className='text-gray-500 text-[10px] uppercase font-bold mb-1 block'>
									Slug (из URL)
								</label>
								<div className='flex items-center gap-2'>
									<span className='text-gray-600 text-xs select-none'>
										mediagame.by/tournament/
									</span>
									<input
										name='slug'
										value={slug}
										onChange={e => setSlug(e.target.value)}
										placeholder='komandnyi-msl'
										className='input-dark flex-1 font-mono text-yellow-400 text-sm'
									/>
								</div>
							</div>

							{/* ID игры и Всего */}
							<div className='grid grid-cols-2 gap-4 mb-3'>
								<div>
									<label className='text-gray-500 text-[10px] uppercase font-bold mb-1 block'>
										Первая игра (ID)
									</label>
									<input
										name='start_game_id'
										type='number'
										value={startGameId}
										onChange={e => setStartGameId(e.target.value)}
										placeholder='2083'
										className='input-dark w-full text-sm font-mono text-white'
									/>
								</div>
								<div>
									<label className='text-gray-500 text-[10px] uppercase font-bold mb-1 block'>
										Всего игр
									</label>
									<input
										name='total_games'
										type='number'
										defaultValue={tournament.total_games || 40}
										placeholder='40'
										className='input-dark w-full text-sm'
									/>
								</div>
							</div>

							{/* ПРЕДПРОСМОТР ССЫЛОК */}
							<div className='border-t border-gray-800 pt-2 space-y-1'>
								<div className='flex justify-between items-center text-[10px]'>
									<span className='text-gray-500'>Список:</span>
									<a
										href={previewListUrl}
										target='_blank'
										className='text-blue-500 hover:underline truncate max-w-[200px]'
									>
										{slug || '...'}
									</a>
								</div>
								{previewGameUrl && (
									<div className='flex justify-between items-center text-[10px]'>
										<span className='text-gray-500'>Тест игры:</span>
										<a
											href={previewGameUrl}
											target='_blank'
											className='text-green-500 hover:underline truncate max-w-[200px]'
										>
											Проверить ID {startGameId}
										</a>
									</div>
								)}
							</div>
						</div>

						<button className='w-full bg-blue-600 py-2 rounded-lg font-bold hover:bg-blue-500 transition shadow-lg mt-4 text-sm'>
							Сохранить настройки
						</button>
					</div>
				</div>
			</form>

			{/* ... (Дальше ПАНЕЛЬ УПРАВЛЕНИЯ СОСТАВОМ и ГРИД остаются без изменений) ... */}
			<div
				className={`bg-gray-900 border border-gray-800 p-4 rounded-xl sticky top-4 z-30 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 transition-opacity duration-300 ${
					isRegClosed ? 'opacity-50 pointer-events-none' : ''
				}`}
			>
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
						className='px-4 py-2 text-red-400 hover:bg-red-900/20 rounded font-bold text-sm'
					>
						Сбросить
					</button>
					<button
						onClick={handleSaveRoster}
						disabled={!hasChanges || isSaving}
						className={`px-6 py-2 rounded font-bold text-lg transition shadow-lg 
                    ${
											hasChanges
												? 'bg-green-600 hover:bg-green-500 text-white'
												: 'bg-gray-800 text-gray-500 cursor-not-allowed'
										}`}
					>
						{isSaving ? 'Сохранение...' : 'Сохранить Состав'}
					</button>
				</div>
			</div>

			<div
				className={`grid grid-cols-1 lg:grid-cols-3 gap-8 transition-all duration-300 ${
					isRegClosed
						? 'opacity-40 grayscale pointer-events-none select-none blur-[1px]'
						: ''
				}`}
			>
				{/* ЛЕВАЯ КОЛОНКА */}
				<div className='lg:col-span-1 bg-gray-900 border border-gray-800 rounded-xl p-4 h-[calc(100vh-300px)] flex flex-col'>
					<h3 className='font-bold mb-4 text-gray-200'>Магазин (Топ-150)</h3>
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
									<div className='text-[10px] text-gray-500'>
										#{p.rank} | {p.rating}
									</div>
								</div>
								<span className='text-green-500 font-bold opacity-0 group-hover:opacity-100'>
									+
								</span>
							</button>
						))}
					</div>
				</div>

				{/* ПРАВАЯ КОЛОНКА */}
				<div className='lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-fit'>
					{distributedBaskets.map((basket, i) => (
						<div key={basket.id} className='flex flex-col gap-2'>
							<div className='bg-gray-800 p-3 rounded-lg border border-gray-700 text-center'>
								<div className='font-bold text-white'>{basket.name}</div>
								<div className='text-xs text-gray-400'>
									{basket.players.length} чел.
								</div>
							</div>
							<div className='space-y-1'>
								{basket.players.map((player: Player) => (
									<div
										key={player.name}
										className='bg-gray-900 p-2 rounded border border-gray-800 flex justify-between items-center group hover:border-red-900/50 transition'
									>
										<span className='text-sm text-gray-300 truncate pr-2'>
											{player.name}
										</span>
										<div className='flex items-center gap-2 shrink-0'>
											<span className='text-[10px] text-yellow-600 font-mono'>
												{player.cost}
											</span>
											<button
												onClick={() => handleRemove(player.name)}
												className='text-gray-600 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100'
											>
												×
											</button>
										</div>
									</div>
								))}
								{Array.from({
									length: Math.max(0, 10 - basket.players.length),
								}).map((_, idx) => (
									<div
										key={idx}
										className='h-9 border border-gray-800/50 border-dashed rounded bg-gray-900/20'
									></div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			{isRegClosed && (
				<div className='absolute inset-0 top-[600px] flex justify-center z-10 pointer-events-none'>
					<div className='bg-gray-900/90 border border-red-900 p-6 rounded-xl text-center shadow-2xl backdrop-blur-md h-fit mt-20 pointer-events-auto'>
						<div className='text-4xl mb-2'>🔒</div>
						<h3 className='text-xl font-bold text-white mb-2'>
							Состав заблокирован
						</h3>
						<p className='text-gray-400 max-w-xs mx-auto text-sm'>
							Регистрация закрыта. Снимите галочку в настройках, чтобы менять
							состав.
						</p>
					</div>
				</div>
			)}
		</div>
	)
}
