import { createClient } from '@/utils/supabase/server'

export const revalidate = 0;

export default async function StatsPage() {
  const supabase = await createClient()

  // Получаем статистику.
  // В Supabase JS нет простого GROUP BY с count, поэтому сделаем через RPC или JS обработку.
  // Для малого объема (40 игроков) JS обработка на сервере работает отлично.
  
  const { data: selections } = await supabase.from('selections').select('player_id')
  const { data: players } = await supabase.from('players').select('*')

  // Считаем кол-во
  const counts: Record<number, number> = {}
  selections?.forEach(s => {
    counts[s.player_id] = (counts[s.player_id] || 0) + 1
  })

  // Сортируем игроков по популярности
  const sortedPlayers = players?.map(p => ({
    ...p,
    count: counts[p.id] || 0
  })).sort((a, b) => b.count - a.count)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Популярность игроков</h1>
      <div className="grid gap-4">
        {sortedPlayers?.map(p => (
          <div key={p.id} className="bg-gray-900 p-4 rounded-lg border border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gray-800 w-8 h-8 flex items-center justify-center rounded font-bold text-gray-400">
                {p.basket}
              </div>
              <span className="font-medium text-lg">{p.name}</span>
            </div>
            <div className="flex items-center gap-2">
               <div className="h-2 w-24 bg-gray-800 rounded-full overflow-hidden">
                 <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${Math.min((p.count / (selections?.length || 1)) * 100 * 4, 100)}%` }} 
                 />
               </div>
               <span className="font-bold text-xl w-8 text-right">{p.count}</span>
               <span className="text-gray-500 text-sm">пиков</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}