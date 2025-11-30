'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useDebouncedCallback } from 'use-debounce'

interface Props {
  totalItems: number
  itemsPerPage: number
  hideSearch?: boolean // <--- Добавили новый пропс (необязательный)
}

export function PicksControls({ totalItems, itemsPerPage, hideSearch }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { replace } = useRouter()

  const currentPage = Number(searchParams.get('page')) || 1
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', '1')
    
    if (term) {
      params.set('query', term)
    } else {
      params.delete('query')
    }
    replace(`${pathname}?${params.toString()}`)
  }, 300)

  const handlePageChange = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', pageNumber.toString())
    replace(`${pathname}?${params.toString()}`)
  }

  // Если пагинация не нужна (всего 1 страница) И поиск скрыт — ничего не рендерим
  if (totalPages <= 1 && hideSearch) return null

  return (
    <div className={`flex flex-col md:flex-row justify-between items-center gap-4 ${!hideSearch ? 'mb-6' : 'mt-4'}`}>
      
      {/* ПОИСК (Рендерим только если НЕ скрыт) */}
      {!hideSearch && (
        <div className="w-full md:w-1/3">
            <input
            placeholder="Поиск по имени..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:outline-none transition text-white"
            onChange={(e) => handleSearch(e.target.value)}
            defaultValue={searchParams.get('query')?.toString()}
            />
        </div>
      )}

      {/* Если поиск скрыт, добавляем пустой блок, чтобы пагинация была справа (через justify-between), 
          либо можно просто центрировать через flex. 
          В данном случае, если поиска нет, пагинация просто встанет по центру или слева в зависимости от justify.
      */}
      {hideSearch && <div />} 

      {/* ПАГИНАЦИЯ */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 bg-gray-900 p-1 rounded-lg border border-gray-800 ml-auto">
          <button
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className="px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent text-white"
          >
            ←
          </button>
          <span className="text-sm text-gray-400 px-2">
            {currentPage} из {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className="px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent text-white"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}