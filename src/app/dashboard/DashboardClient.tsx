'use client'

import { SelectionCard } from '@/components/SelectionCard'
import { StatsHeader } from '@/components/StatsHeader'
import { TournamentSelect } from '@/components/TournamentSelect'
import { BasketWithPlayers, SelectionWithCost, Tournament } from '@/types'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { saveSelections } from './action' // Создадим эту функцию

type PlayerSelection = {
	playerId: number
	cost: number
	basketId: number
}

// Вспомогательная функция для преобразования
const mapSelectionsToState = (
	selections: SelectionWithCost[]
): PlayerSelection[] => {
	return selections.map(s => ({
		playerId: s.player_id,
		cost: s.players.cost,
		basketId: s.players.baskets.basket_id,
	}))
}

export default function DashboardClient({
	userEmail,
	profileUsername,
	tournaments,
	currentTournament,
	isReadOnly,
	baskets,
	initialMySelections,
	userId,
}: {
	userEmail: string | undefined
	profileUsername: string | undefined
	tournaments: Tournament[]
	currentTournament: Tournament
	isReadOnly: boolean
	baskets: BasketWithPlayers[]
	initialMySelections: SelectionWithCost[]
	userId: string
}) {
	const router = useRouter()

	// 1. Состояние для временных выборов
	const [tempSelections, setTempSelections] = useState<PlayerSelection[]>(
		mapSelectionsToState(initialMySelections)
	)

	// Состояние для загрузки и ошибок
	const [isSaving, setIsSaving] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)

	// Проверка на наличие несохраненных изменений
	const hasChanges = useMemo(() => {
		// Сортируем для надежного сравнения массивов объектов
		const initialIds = initialMySelections.map(s => s.player_id).sort()
		const currentIds = tempSelections.map(s => s.playerId).sort()

		if (initialIds.length !== currentIds.length) return true
		for (let i = 0; i < initialIds.length; i++) {
			if (initialIds[i] !== currentIds[i]) return true
		}
		return false
	}, [initialMySelections, tempSelections])

	// 2. Обновление временного выбора
	const handleSelectionChange = (
		playerId: number,
		cost: number,
		basketId: number,
		isSelected: boolean
	) => {
		setSaveError(null)
		setTempSelections(prevSelections => {
			// Ищем, есть ли уже выбранный игрок в этой корзине
			const existingSelection = prevSelections.find(
				s => s.basketId === basketId
			)

			let newSelections = prevSelections.filter(s => s.basketId !== basketId)

			if (isSelected) {
				// Добавляем новый выбор
				newSelections.push({ playerId, cost, basketId })
			} else if (existingSelection?.playerId === playerId) {
				// Если игрок был выбран и мы его снимаем, ничего не добавляем (он уже удален фильтром)
			} else {
				// Случай, который не должен произойти, но на всякий случай
				return prevSelections
			}

			return newSelections
		})
	}

	// 3. Расчет бюджета на основе временного состояния
	const spent = useMemo(() => {
		return tempSelections.reduce((acc, s) => acc + s.cost, 0)
	}, [tempSelections])

	const remaining = currentTournament.budget - spent

	// 4. Логика отправки
	const handleSave = async () => {
		if (isReadOnly || isSaving || !hasChanges) return
		setIsSaving(true)
		setSaveError(null)

		try {
			await saveSelections(userId, currentTournament.id, tempSelections)

			// Перезагрузка страницы, чтобы Next.js перевалидировал данные
			// Это приведет к тому, что `initialMySelections` обновится и `hasChanges` станет false
			router.refresh()
		} catch (error) {
			console.error(error)
			setSaveError('Ошибка сохранения: ' + (error as Error).message)
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<div className='space-y-6 pb-20'>
			{/* Шапка с выбором турнира */}
			<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
				<div>
					<h1 className='text-xl font-bold text-white flex items-center gap-2'>
						Кабинет
						{isReadOnly && (
							<span className='bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded border border-gray-700 uppercase tracking-wider'>
								Архив
							</span>
						)}
					</h1>
					<p className='text-sm text-gray-500'>{currentTournament.name}</p>
				</div>
				<div className='w-full sm:w-auto'>
					<TournamentSelect
						tournaments={tournaments}
						activeId={currentTournament.id}
					/>
				</div>
			</div>

			{/* Инфо о бюджете */}
			<StatsHeader
				username={profileUsername || userEmail}
				budget={currentTournament.budget}
				spent={spent} // Используем расчет из состояния
				remaining={remaining} // Используем расчет из состояния
			/>

			{/* Кнопка Сохранить и Ошибка */}
			<div className='flex flex-col gap-2'>
				<button
					onClick={handleSave}
					disabled={isReadOnly || isSaving || !hasChanges}
					className={`px-4 py-2 rounded-lg font-semibold transition-colors 
            ${
							hasChanges && !isReadOnly && !isSaving
								? 'bg-blue-600 hover:bg-blue-700 text-white'
								: 'bg-gray-700 text-gray-500 cursor-not-allowed'
						}`}
				>
					{isSaving ? 'Сохранение...' : 'Сохранить выбор'}
				</button>
				{saveError && (
					<p className='text-red-500 text-sm p-2 bg-red-900/20 rounded border border-red-900'>
						{saveError}
					</p>
				)}
			</div>

			{/* Сетка корзин */}
			<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6'>
				{baskets?.map(basket => {
					const selectedInBasket = tempSelections.filter(
						s => s.basketId === basket.id
					).length
					const isBasketFull = selectedInBasket >= basket.allowed_picks

					return (
						<div
							key={basket.id}
							className='bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col shadow-lg'
						>
							<div className='bg-gray-800/50 p-3 border-b border-gray-700 flex justify-between items-center'>
								<h3 className='font-bold text-base text-gray-200'>
									{basket.name}
								</h3>
								<span className='text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded uppercase font-bold tracking-wider'>
									Выбрано: {selectedInBasket} / {basket.allowed_picks}
								</span>
							</div>

							<div className='p-1 space-y-1 flex-1'>
								{basket.players
									.sort((a, b) => b.cost - a.cost)
									.map(player => {
										// Используем временное состояние для определения isSelected
										const isSelected = tempSelections.some(
											s => s.playerId === player.id
										)

										// Кнопка недоступна, если:
										// 1. Турнир архивный (isReadOnly)
										// 2. ИЛИ денег мало И игрок не выбран
										// 3. ИЛИ корзина уже заполнена И игрок не выбран
										const isDisabled =
											isReadOnly ||
											(!isSelected && remaining < player.cost) ||
											(!isSelected && isBasketFull)

										return (
											<SelectionCard
												key={player.id}
												player={player}
												isSelected={isSelected}
												isDisabled={isDisabled}
												// Передаем новый обработчик, вместо прямого взаимодействия с БД
												onSelect={() =>
													handleSelectionChange(
														player.id,
														player.cost,
														basket.id,
														!isSelected
													)
												}
												// Удаляем старые пропсы для Server Action
												// tournamentId={currentTournament.id}
												// basketId={basket.id}
											/>
										)
									})}
							</div>
						</div>
					)
				})}
				{baskets?.length === 0 && (
					<div className='col-span-full text-center py-10 text-gray-500'>
						В этом турнире нет корзин
					</div>
				)}
			</div>
		</div>
	)
}
