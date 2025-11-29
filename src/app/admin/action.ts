'use server'

import { createClient } from '@supabase/supabase-js' // <--- МЕНЯЕМ ИМПОРТ
import { revalidatePath } from 'next/cache'

// Создаем "Админского" клиента, который игнорирует правила RLS
const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Используем сервисный ключ
  )
}

// Вспомогательная функция: Пересчет бюджета
async function recalculateBudget(tournamentId: number) {
  const supabase = getAdminClient()

  const { data: players } = await supabase
    .from('players')
    .select('cost, baskets!inner(tournament_id)')
    .eq('baskets.tournament_id', tournamentId)

  if (!players || players.length === 0) return

  const totalCost = players.reduce((sum, p) => sum + p.cost, 0)
  const averageCost = totalCost / players.length
  const newBudget = Math.round(averageCost * 4)

  await supabase
    .from('tournaments')
    .update({ budget: newBudget })
    .eq('id', tournamentId)
}

// --- ОСНОВНЫЕ ЭКШЕНЫ ---

export async function createTournament(name: string, budget: number) {
  const supabase = getAdminClient()
  
  const { data: tour, error } = await supabase
    .from('tournaments')
    .insert({ name, budget, is_active: false })
    .select()
    .single()

  if (error) return { error: error.message }

  const baskets = [1, 2, 3, 4].map(i => ({
    tournament_id: tour.id,
    name: `Корзина ${i}`,
    sort_order: i,
    allowed_picks: 1
  }))

  await supabase.from('baskets').insert(baskets)

  revalidatePath('/admin')
  return { success: true, id: tour.id }
}

export async function updateTournament(id: number, name: string, isActive: boolean) {
  const supabase = getAdminClient()
  
  if (isActive) {
    await supabase.from('tournaments').update({ is_active: false }).neq('id', 0)
  }

  const { error } = await supabase
    .from('tournaments')
    .update({ name, is_active: isActive })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/')
  return { success: true }
}

// ФУНКЦИЯ, КОТОРАЯ ВЫЗЫВАЛА ОШИБКУ
export async function saveTournamentRoster(
  tournamentId: number, 
  playersData: { name: string; cost: number; basket_id: number }[]
) {
  const supabase = getAdminClient() // <-- Теперь тут полные права

  // 1. Удаляем ВСЕХ текущих игроков этого турнира
  const { data: baskets } = await supabase
    .from('baskets')
    .select('id')
    .eq('tournament_id', tournamentId)
  
  const basketIds = baskets?.map(b => b.id) || []

  if (basketIds.length > 0) {
    await supabase.from('players').delete().in('basket_id', basketIds)
  }

  // 2. Вставляем новых
  if (playersData.length > 0) {
    const { error } = await supabase.from('players').insert(playersData)
    if (error) return { error: error.message }
  }

  // 3. Пересчитываем бюджет
  if (playersData.length > 0) {
      const totalCost = playersData.reduce((sum, p) => sum + p.cost, 0)
      const avg = totalCost / playersData.length
      const newBudget = Math.round(avg * 4)
      
      await supabase
        .from('tournaments')
        .update({ budget: newBudget })
        .eq('id', tournamentId)
  }

  revalidatePath('/admin/tournament/[id]', 'page')
  revalidatePath('/')
  return { success: true }
}

export async function addPlayerToTournament(basketId: number, tournamentId: number, name: string, rating: number) {
  const supabase = getAdminClient()
  const { error } = await supabase.from('players').insert({
      basket_id: basketId,
      name: name,
      cost: rating,
      points: 0,
    })
  if (error) return { error: error.message }
  await recalculateBudget(tournamentId)
  revalidatePath('/admin/tournament/[id]', 'page')
  return { success: true }
}

export async function removePlayerFromTournament(playerId: number, tournamentId: number) {
  const supabase = getAdminClient()
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) return { error: error.message }
  await recalculateBudget(tournamentId)
  revalidatePath('/admin/tournament/[id]', 'page')
  return { success: true }
}