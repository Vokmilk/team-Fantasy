'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  tournaments: { id: number; name: string; is_active: boolean }[]
  activeId: number
}

export function TournamentSelect({ tournaments, activeId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value
    
    // Сохраняем текущие параметры URL, но меняем tournamentId
    const params = new URLSearchParams(searchParams.toString())
    params.set('tournamentId', newId)
    
    // Перезагружаем страницу с новым параметром
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-gray-400 text-sm">Турнир:</span>
      <select 
        value={activeId} 
        onChange={handleChange}
        className="bg-gray-900 border border-gray-700 text-white text-sm rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
      >
        {tournaments.map(t => (
          <option key={t.id} value={t.id}>
            {t.name} {t.is_active ? '(Активный)' : '(Архив)'}
          </option>
        ))}
      </select>
    </div>
  )
}