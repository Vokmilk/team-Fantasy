'use client'

import { saveUserPicks } from '@/app/actions'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SelectionCard } from './SelectionCard'
import { StatsHeader } from './StatsHeader'

interface Player {
	id: number
	name: string
	cost: number
	points: number
	basket_id: number
}

interface Basket {
	id: number
	name: string
	allowed_picks: number
	players: Player[]
}

interface Props {
	userProfile: any
	tournament: any
	baskets: Basket[]
	initialPicksIds: number[]
}

export function DashboardManager({
	userProfile,
	tournament,
	baskets,
	initialPicksIds,
}: Props) {
	// 1. Инициализация состояния
	const [selectedIds, setSelectedIds] = useState<number[]>(initialPicksIds)
	const [isPending, startTransition] = useTransition()
	const [hasChanges, setHasChanges] = useState(false)

	// 2. Расчет бюджета "на лету"
	// Собираем всех игроков в плоский список для удобства поиска
	const allPlayers = useMemo(() => baskets.flatMap(b => b.players), [baskets])

	const spent = useMemo(() => {
		return selectedIds.reduce((sum, id) => {
			const p = allPlayers.find(pl => pl.id === id)
			return sum + (p?.cost || 0)
		}, 0)
	}, [selectedIds, allPlayers])

	const remaining = tournament.budget - spent

	// 3. Статусы валидации
	const isReadOnly = !tournament.is_active || tournament.is_registration_closed
	const isCountValid = selectedIds.length === 4
	const isBudgetValid = remaining >= 0
	const isValid = isCountValid && isBudgetValid

	// 4. Логика Клика (Выбор/Замена)
	const handleToggle = (player: Player) => {
		if (isReadOnly) return

		setSelectedIds(prev => {
			const isAlreadySelected = prev.includes(player.id)
			setHasChanges(true)

			if (isAlreadySelected) {
				// Если кликнули по уже выбранному -> снимаем выбор
				return prev.filter(id => id !== player.id)
			} else {
				// Если кликнули по новому:
				// 1. Находим игроков из ЭТОЙ ЖЕ корзины, которые уже выбраны
				const currentBasketPlayerIds =
					baskets
						.find(b => b.id === player.basket_id)
						?.players.map(p => p.id) || []

				// 2. Убираем их из списка (авто-замена)
				const otherPicks = prev.filter(
					id => !currentBasketPlayerIds.includes(id)
				)

				// 3. Добавляем нового
				return [...otherPicks, player.id]
			}
		})
	}

	// 5. Обработчик клика по кнопке "Сохранить"
	// Используем паттерн "Ложно-неактивная кнопка" для мобильных
	const handleSaveClick = () => {
		// Если данные невалидны - показываем ошибку и не сохраняем
		if (!isCountValid) {
			toast.error(
				`Нужно выбрать ровно 4 игрока! (Выбрано: ${selectedIds.length})`
			)
			return
		}
		if (!isBudgetValid) {
			toast.error(`Бюджет превышен на ${Math.abs(remaining)}!`)
			return
		}

		// Если все ок - отправляем на сервер
		startTransition(async () => {
			try {
				const res = await saveUserPicks(tournament.id, selectedIds)
				if (res?.success) {
					setHasChanges(false)
					toast.success('Команда успешно сохранена! 🏆')
				}
			} catch (e: any) {
				toast.error(e.message)
			}
		})
	}

	// 6. Сброс изменений
	const handleReset = () => {
		if (confirm('Вернуть как было до изменений?')) {
			setSelectedIds(initialPicksIds)
			setHasChanges(false)
			toast.info('Изменения сброшены')
		}
	}

	// Текст ошибки для Tooltip (ПК)
	const getErrorTooltip = () => {
		if (!isCountValid) return `Выберите 4 игроков`
		if (!isBudgetValid) return `Бюджет превышен`
		return null
	}
	const errorTooltip = getErrorTooltip()

	return (
		<div className='space-y-6 pb-24'>
			{/* Sticky Header (Прилипающая шапка с бюджетом и кнопкой) */}
			<div className='sticky top-[60px] z-30 space-y-4 bg-gray-950/95 backdrop-blur pb-3 pt-2 border-b border-gray-800/50 -mx-4 px-4 md:mx-0 md:px-0 shadow-sm transition-all'>
				<StatsHeader
					username={userProfile?.username || userProfile?.email}
					budget={tournament.budget}
					spent={spent}
					remaining={remaining}
				/>

				{!isReadOnly && (
					<div className='flex gap-3 justify-end items-center relative'>
						<div className='text-xs text-gray-500 font-medium hidden sm:block'>
							Выбрано:{' '}
							<span
								className={isCountValid ? 'text-green-400' : 'text-yellow-500'}
							>
								{selectedIds.length}/4
							</span>
						</div>

						{hasChanges && (
							<button
								onClick={handleReset}
								className='px-3 py-2 text-gray-400 hover:text-white text-sm transition'
							>
								Отмена
							</button>
						)}

						{/* КНОПКА СОХРАНЕНИЯ С WRAPPER ДЛЯ TOOLTIP */}
						<div className='relative group'>
							<button
								onClick={handleSaveClick}
								// Блокируем только если нет изменений или идет загрузка.
								// Если есть ошибка валидации - кнопка остается кликабельной (чтобы показать тост)
								disabled={!hasChanges || isPending}
								className={`px-6 py-2.5 rounded-lg font-bold text-white shadow-lg transition-all flex items-center gap-2
                                    ${
																			isValid && hasChanges
																				? 'bg-green-600 hover:bg-green-500 hover:scale-[1.02] shadow-green-900/30'
																				: 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-80' // Визуально серая
																		}`}
							>
								{isPending
									? 'Сохранение...'
									: hasChanges
									? 'Сохранить команду'
									: 'Сохранено'}
							</button>

							{/* TOOLTIP (Только для ПК при наведении) */}
							{hasChanges && !isValid && (
								<div className='absolute right-0 top-full mt-2 w-max max-w-[200px] hidden md:group-hover:block z-50 animate-in fade-in slide-in-from-top-2'>
									<div className='bg-red-900 text-white text-xs px-3 py-2 rounded shadow-xl border border-red-700 relative'>
										<div className='absolute -top-1 right-6 w-2 h-2 bg-red-900 border-t border-l border-red-700 transform rotate-45'></div>
										{errorTooltip}
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* СЕТКА С КОРЗИНАМИ */}
			<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6'>
				{baskets?.map(basket => (
					<div
						key={basket.id}
						className='bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col shadow-lg'
					>
						<div className='bg-gray-800/50 p-3 border-b border-gray-700 flex justify-between items-center'>
							<h3 className='font-bold text-base text-gray-200'>
								{basket.name}
							</h3>
							<span className='text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded uppercase font-bold tracking-wider'>
								Выбрать: {basket.allowed_picks}
							</span>
						</div>

						<div className='p-1 space-y-1 flex-1'>
							{basket.players
								.sort((a, b) => b.cost - a.cost)
								.map(player => {
									const isSelected = selectedIds.includes(player.id)
									// Кнопки всегда активны для клика (кроме архива),
									// чтобы можно было менять состав даже при нехватке бюджета (пока не нажмешь Сохранить)
									const isDisabled = isReadOnly

									return (
										<SelectionCard
											key={player.id}
											player={player}
											isSelected={isSelected}
											isDisabled={isDisabled}
											onToggle={handleToggle}
										/>
									)
								})}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
