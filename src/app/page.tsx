import { createClient } from '@/utils/supabase/server'
import { saveSelection } from './actions'

export const revalidate = 0; // Всегда свежие данные

export default async function Dashboard() {
  const supabase = await createClient()
  
  // 1. Получаем текущего юзера
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 2. Получаем всех игроков
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .order('id')

  // 3. Получаем текущие выборы пользователя
  const { data: selections } = await supabase
    .from('selections')
    .select('*')
    .eq('user_id', user.id)

  // Группируем игроков по корзинам
  const baskets = [1, 2, 3, 4]

  return (
    <div className="space-y-8">
      <header className="text-center py-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Собери свою команду
        </h1>
        <p className="text-gray-400 mt-2">Выберите по 1 игроку из каждой корзины</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {baskets.map((basketNum) => {
          // Находим, кого юзер уже выбрал в этой корзине
          const currentPick = selections?.find(s => s.basket === basketNum)
          // Игроки этой корзины
          const basketPlayers = players?.filter(p => p.basket === basketNum) || []

          return (
            <div key={basketNum} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="bg-gray-800 p-3 border-b border-gray-700 font-bold text-center">
                Корзина {basketNum}
              </div>
              <div className="p-2 space-y-1">
                {basketPlayers.map(player => {
                  const isSelected = currentPick?.player_id === player.id
                  return (
                    <SelectionButton 
                      key={player.id} 
                      player={player} 
                      isSelected={isSelected} 
                      basket={basketNum} 
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Клиентский компонент для кнопки, чтобы использовать useFormStatus или transition
// Но для простоты сделаем форму напрямую
function SelectionButton({ player, isSelected, basket }: { player: any, isSelected: boolean, basket: number }) {
  const bindSave = saveSelection.bind(null, basket, player.id)

  return (
    <form action={bindSave}>
      <button 
        className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex justify-between items-center
          ${isSelected 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
            : 'hover:bg-gray-800 text-gray-300'
          }`}
      >
        <span>{player.name}</span>
        {isSelected && <span className="text-xs bg-white text-blue-600 px-2 py-0.5 rounded-full font-bold">Выбран</span>}
      </button>
    </form>
  )
}