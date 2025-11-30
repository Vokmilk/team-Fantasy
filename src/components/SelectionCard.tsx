'use client'

interface Props {
	player: any
	isSelected: boolean
	isDisabled: boolean
	onToggle: (player: any) => void // Callback
}

export function SelectionCard({
	player,
	isSelected,
	isDisabled,
	onToggle,
}: Props) {
	// Больше нет useTransition и saveSelection здесь!

	let baseClasses =
		'w-full text-left p-2 rounded-lg border transition-all relative group '

	if (isSelected) {
		baseClasses += 'bg-blue-600/20 border-blue-500 text-white cursor-pointer '
	} else if (isDisabled) {
		baseClasses +=
			'bg-gray-900/50 border-transparent opacity-50 cursor-not-allowed '
	} else {
		baseClasses +=
			'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750 '
	}

	return (
		<button
			onClick={() => !isDisabled && onToggle(player)}
			disabled={isDisabled}
			className={baseClasses}
		>
			<div className='flex justify-between items-center w-full'>
				<span className='font-medium text-sm truncate pr-2 flex-1 text-left'>
					{player.name}
				</span>
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
