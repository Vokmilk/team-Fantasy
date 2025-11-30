'use client'

import { saveUserPicks } from '@/app/actions'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner' // <--- Импорт тоста
import { SelectionCard } from './SelectionCard'
import { StatsHeader } from './StatsHeader'

export function DashboardManager({
	userProfile,
	tournament,
	baskets,
	initialPicksIds,
}: any) {
	const [selectedIds, setSelectedIds] = useState<number[]>(initialPicksIds)
	const [isPending, startTransition] = useTransition()
	const [hasChanges, setHasChanges] = useState(false)

	// 1. Расчет бюджета
	const allPlayers = useMemo(
		() => baskets.flatMap((b: any) => b.players),
		[baskets]
	)

	const spent = useMemo(() => {
		return selectedIds.reduce((sum, id) => {
			const p = allPlayers.find((pl: any) => pl.id === id)
			return sum + (p?.cost || 0)
		}, 0)
	}, [selectedIds, allPlayers])

	const remaining = tournament.budget - spent

	// 2. Логика Клика
	const handleToggle = (player: any) => {
		if (!tournament.is_active) return

		setSelectedIds(prev => {
			const isAlreadySelected = prev.includes(player.id)
			setHasChanges(true)

			if (isAlreadySelected) {
				return prev.filter(id => id !== player.id)
			} else {
				// Удаляем старого игрока из этой же корзины (замена)
				const currentBasketPlayerIds =
					baskets
						.find((b: any) => b.id === player.basket_id)
						?.players.map((p: any) => p.id) || []

				const otherPicks = prev.filter(
					id => !currentBasketPlayerIds.includes(id)
				)
				return [...otherPicks, player.id]
			}
		})
	}

	// 3. Сохранение
	const handleSave = () => {
		startTransition(async () => {
			try {
				const res = await saveUserPicks(tournament.id, selectedIds)
				if (res?.success) {
					setHasChanges(false)
					// ВЫЗОВ ТОСТА
					toast.success('Команда успешно сохранена! 🏆')
				}
			} catch (e: any) {
				// Если ошибка пришла с сервера
				toast.error(e.message)
			}
		})
	}

	// 4. Сброс
	const handleReset = () => {
		if (confirm('Вернуть как было?')) {
			setSelectedIds(initialPicksIds)
			setHasChanges(false)
			toast.info('Изменения сброшены')
		}
	}

	// --- ВАЛИДАЦИЯ ---
	const isCountValid = selectedIds.length === 4
	const isBudgetValid = remaining >= 0
	const isValid = isCountValid && isBudgetValid
	const isReadOnly = !tournament.is_active

	// Генерируем текст ошибки для подсказки
	const getErrorTooltip = () => {
		if (!isCountValid)
			return `Нужно выбрать 4 игроков (выбрано: ${selectedIds.length})`
		if (!isBudgetValid) return `Бюджет превышен на ${Math.abs(remaining)}`
		return null
	}
	const errorTooltip = getErrorTooltip()

	return (
		<div className='space-y-6 pb-24'>
			{/* Sticky Header */}
			<div className='sticky top-[60px] z-30 space-y-4 bg-gray-950/90 backdrop-blur pb-2 pt-2 border-b border-gray-800/50 -mx-4 px-4 md:mx-0 md:px-0'>
				<StatsHeader
					username={userProfile?.username || userProfile?.email}
					budget={tournament.budget}
					spent={spent}
					remaining={remaining}
				/>

				{!isReadOnly && (
					<div className='flex gap-3 justify-end items-center relative'>
						<div className='text-xs text-gray-500 font-medium'>
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

						{/* КНОПКА С ПОДСКАЗКОЙ */}
						{/* Оборачиваем в div.group, чтобы показывать подсказку при наведении на весь блок, даже если кнопка disabled */}
						<div className='relative group'>
							<button
								onClick={handleSave}
								disabled={!hasChanges || isPending || !isValid}
								className={`px-6 py-2.5 rounded-lg font-bold text-white shadow-lg transition-all flex items-center gap-2
                                    ${
																			isValid && hasChanges
																				? 'bg-green-600 hover:bg-green-500 hover:scale-[1.02] shadow-green-900/30'
																				: 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-70'
																		}`}
							>
								{isPending
									? 'Сохранение...'
									: hasChanges
									? 'Сохранить команду'
									: 'Сохранено'}
							</button>

							{/* САМА ПОДСКАЗКА (TOOLTIP) */}
							{/* Показываем, только если есть ошибка и есть изменения (или кнопка неактивна из-за ошибки) */}
							{hasChanges && !isValid && (
								<div className='absolute right-0 top-full mt-2 w-max max-w-[250px] hidden group-hover:block z-50'>
									<div className='bg-red-900 text-white text-xs px-3 py-2 rounded shadow-xl border border-red-700 relative'>
										{/* Стрелочка вверх */}
										<div className='absolute -top-1 right-6 w-2 h-2 bg-red-900 border-t border-l border-red-700 transform rotate-45'></div>
										{errorTooltip}
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Сетка */}
			<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6'>
				{baskets?.map((basket: any) => (
					<div
						key={basket.id}
						className='bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col shadow-lg'
					>
						{/* ... код корзины без изменений ... */}
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
								.sort((a: any, b: any) => b.cost - a.cost)
								.map((player: any) => {
									const isSelected = selectedIds.includes(player.id)
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
