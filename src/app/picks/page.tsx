import { createClient } from '@/utils/supabase/server'

export const revalidate = 0;

export default async function AllPicksPage() {
  const supabase = await createClient()

  // Получаем профили
  const { data: profiles } = await supabase.from('profiles').select('*')
  
  // Получаем выборы вместе с информацией об игроках
  const { data: allSelections } = await supabase
    .from('selections')
    .select(`
      user_id,
      basket,
      players ( id, name )
    `)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Выбор участников</h1>
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-900 text-gray-400 uppercase">
            <tr>
              <th className="p-4">Участник</th>
              <th className="p-4">Корзина 1</th>
              <th className="p-4">Корзина 2</th>
              <th className="p-4">Корзина 3</th>
              <th className="p-4">Корзина 4</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-900/50">
            {profiles?.map(user => {
              // Находим пики этого пользователя
              const userPicks = allSelections?.filter(s => s.user_id === user.id)
              
              const getPickName = (basket: number) => {
                const pick = userPicks?.find(s => s.basket === basket)
                // @ts-ignore: Supabase typing can be tricky with joins without generation
                return pick?.players?.name || '-'
              }

              return (
                <tr key={user.id} className="hover:bg-gray-800/50">
                  <td className="p-4 font-medium text-white">{user.email}</td>
                  <td className="p-4 text-gray-300">{getPickName(1)}</td>
                  <td className="p-4 text-gray-300">{getPickName(2)}</td>
                  <td className="p-4 text-gray-300">{getPickName(3)}</td>
                  <td className="p-4 text-gray-300">{getPickName(4)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}