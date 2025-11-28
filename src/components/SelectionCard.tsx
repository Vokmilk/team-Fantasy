'use client'

import { saveSelection } from "@/app/actions"
import { useTransition } from "react"

export function SelectionCard({ player, isSelected, isDisabled, tournamentId, basketId }: any) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    if (isSelected) return // Можно добавить логику снятия пика
    startTransition(async () => {
        try {
            await saveSelection(tournamentId, basketId, player.id)
        } catch (e: any) {
            alert(e.message) // Простая обработка ошибки бюджета
        }
    })
  }

  return (
    <button 
      onClick={handleClick}
      disabled={isDisabled || isPending}
      className={`w-full text-left p-3 rounded-lg border transition-all relative group
        ${isSelected 
          ? 'bg-blue-600/20 border-blue-500 text-white' 
          : isDisabled 
            ? 'bg-gray-900/50 border-transparent opacity-50 cursor-not-allowed'
            : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750'
        }
      `}
    >
      <div className="flex justify-between items-start">
        <span className="font-medium pr-8">{player.name}</span>
        <span className="font-mono text-yellow-500 font-bold">{player.cost}</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">Очки: {player.points}</div>
      
      {isSelected && (
        <div className="absolute top-2 right-2 text-blue-400">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        </div>
      )}
    </button>
  )
}