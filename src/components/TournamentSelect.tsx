'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface Tournament {
	id: number
	name: string
	is_active: boolean
}

interface Props {
	tournaments: Tournament[]
	activeId: number
}

export function TournamentSelect({ tournaments, activeId }: Props) {
	const router = useRouter()
	const searchParams = useSearchParams()
	const pathname = usePathname()

	const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newId = e.target.value

		// 1. Берем текущие параметры URL
		const params = new URLSearchParams(searchParams.toString())

		// 2. Устанавливаем новый ID турнира
		params.set('tournamentId', newId)

		// 3. Меняем URL (это вызовет перезагрузку серверной страницы с новыми данными)
		router.push(`${pathname}?${params.toString()}`)
	}

	return (
		<div className='flex items-center gap-3 bg-gray-900 p-1.5 rounded-lg border border-gray-800'>
			<span className='text-xs text-gray-500 font-bold uppercase pl-2'>
				Сезон:
			</span>
			<select
				value={activeId}
				onChange={handleChange}
				className='bg-gray-800 text-white text-sm rounded py-1.5 px-3 border border-gray-700 focus:border-blue-500 focus:outline-none cursor-pointer hover:bg-gray-700 transition'
			>
				{tournaments.map(t => (
					<option key={t.id} value={t.id}>
						{t.name} {t.is_active ? '(Активный)' : ''}
					</option>
				))}
			</select>
		</div>
	)
}
