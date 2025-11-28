'use client'

import { saveSelection, removeSelection } from "@/app/actions"
import { useTransition } from "react"

export function SelectionCard({ player, isSelected, isDisabled, tournamentId, basketId }: any) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    // Предотвращаем клик, если действие еще выполняется
    if (isPending) return

    startTransition(async () => {
        try {
            if (isSelected) {
                // ЛОГИКА ОТМЕНЫ: Если уже выбран — удаляем из базы
                await removeSelection(player.id)
            } else {
                // ЛОГИКА ВЫБОРА: Если не выбран — сохраняем
                await saveSelection(tournamentId, basketId, player.id)
            }
        } catch (e: any) {
            alert(e.message)
        }
    })
  }

  // Определяем стили в зависимости от состояния
  let baseClasses = "w-full text-left p-2 rounded-lg border transition-all relative group "
  
  if (isSelected) {
      // 1. ВЫБРАН: Синий фон. 
      // При наведении (hover) -> Красный фон (показываем, что клик удалит выбор)
      baseClasses += "bg-blue-600/20 border-blue-500 text-white hover:bg-red-900/30 hover:border-red-500 cursor-pointer "
  } else if (isDisabled) {
      // 2. НЕДОСТУПЕН: Тусклый, курсор запрета
      baseClasses += "bg-gray-900/50 border-transparent opacity-50 cursor-not-allowed "
  } else {
      // 3. ДОСТУПЕН: Серый, при наведении светлеет
      baseClasses += "bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750 "
  }

  return (
    <button 
      onClick={handleClick}
      disabled={isDisabled || isPending}
      className={baseClasses}
    >
      {/* Верхняя строка: Имя + Цена */}
      <div className="flex justify-between items-center">
        <span className="font-medium pr-8 text-sm truncate">{player.name}</span>
        <span className="font-mono text-yellow-500 font-bold text-sm">{player.cost}</span>
      </div>
      
      {/* Нижняя строка: Очки */}
      <div className="text-[10px] text-gray-500 mt-0.5">Очки: {player.points}</div>
      
      {/* Иконка статуса (только для выбранных) */}
      {isSelected && (
        <div className="absolute top-2 right-2 text-blue-400 group-hover:text-red-400 transition-colors">
          
          {/* Галочка (видна, когда мышь НЕ наведена) */}
          <div className="group-hover:hidden">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          </div>
          
          {/* Крестик (виден, когда мышь НАВЕДЕНА - hover) */}
          <div className="hidden group-hover:block">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </div>
          
        </div>
      )}
    </button>
  )
}