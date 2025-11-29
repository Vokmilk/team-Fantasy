'use client'

import { removeSelection, saveSelection } from '@/app/actions'
import { useTransition } from 'react'

export function SelectionCard({
	player,
	isSelected,
	isDisabled,
	tournamentId,
	basketId,
}: any) {
	const [isPending, startTransition] = useTransition()

	const handleClick = () => {
		if (isPending) return

		startTransition(async () => {
			try {
				if (isSelected) {
					await removeSelection(player.id)
				} else {
					await saveSelection(tournamentId, basketId, player.id)
				}
			} catch (e: any) {
				alert(e.message)
			}
		})
	}

	// Стили
	let baseClasses =
		'w-full text-left p-2 rounded-lg border transition-all relative group '

	if (isSelected) {
		// Выбран: Синий фон -> при наведении Красный
		baseClasses +=
			'bg-blue-600/20 border-blue-500 text-white hover:bg-red-900/30 hover:border-red-500 cursor-pointer '
	} else if (isDisabled) {
		// Недоступен
		baseClasses +=
			'bg-gray-900/50 border-transparent opacity-50 cursor-not-allowed '
	} else {
		// Доступен
		baseClasses +=
			'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750 '
	}

	return (
		<button
			onClick={handleClick}
			disabled={isDisabled || isPending}
			className={baseClasses}
		>
			<div className='flex justify-between items-center w-full'>
				{/* Имя (обрезается если длинное) */}
				<span className='font-medium text-sm truncate pr-2 flex-1 text-left'>
					{player.name}
				</span>

				{/* Цена (всегда видна, без иконки поверх) */}
				<span className='font-mono text-yellow-500 font-bold text-sm flex-shrink-0'>
					{player.cost}
				</span>
			</div>

			<div className='text-[10px] text-gray-500 mt-0.5 text-left'>
				Очки: {player.points}
			</div>
		</button>
	)
}
