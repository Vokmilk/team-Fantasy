import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
// Импортируем новый тип
import { SelectionWithDetails } from '@/types'

export default async function UserProfile({
	params,
}: {
	params: { id: string }
}) {
	// Await params, так как в Next.js 15+ params стал Promise (на будущее, но работает и так в 14)
	const { id } = params

	const supabase = await createClient()

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', id)
		.single()

	const { data: selectionsData } = await supabase
		.from('selections')
		.select(
			`
      players (
        name, cost, points,
        baskets ( name, sort_order )
      )
    `
		)
		.eq('user_id', id)

	// 1. ПРИМЕНЯЕМ ТИП ЗДЕСЬ
	// Мы говорим: "Supabase вернул массив объектов, соответствующих SelectionWithDetails"
	const selections = selectionsData as unknown as SelectionWithDetails[]

	// Теперь TypeScript знает структуру и не будет ругаться на .points или .baskets
	const totalPoints =
		selections?.reduce((acc, s) => acc + s.players.points, 0) || 0
	const totalCost = selections?.reduce((acc, s) => acc + s.players.cost, 0) || 0

	return (
		<div className='max-w-4xl mx-auto'>
			<div className='mb-6 flex items-center gap-4'>
				<Link
					href='/picks'
					className='p-2 bg-gray-800 rounded hover:bg-gray-700'
				>
					← Назад
				</Link>
				<h1 className='text-3xl font-bold'>
					{profile?.username || 'Пользователь'}
				</h1>

				{/* Проверка на наличие бейджиков с безопасным доступом */}
				{(profile?.badges as string[] | null)?.includes('top3') && (
					<span className='bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-sm border border-yellow-500/50'>
						🏆 Top Player
					</span>
				)}
			</div>

			<div className='grid grid-cols-2 gap-4 mb-8'>
				<div className='bg-gray-900 p-6 rounded-xl border border-gray-800 text-center'>
					<div className='text-gray-400 mb-1'>Очки команды</div>
					<div className='text-4xl font-bold text-blue-400'>{totalPoints}</div>
				</div>
				<div className='bg-gray-900 p-6 rounded-xl border border-gray-800 text-center'>
					<div className='text-gray-400 mb-1'>Стоимость состава</div>
					<div className='text-4xl font-bold text-purple-400'>{totalCost}</div>
				</div>
			</div>

			<h2 className='text-xl font-bold mb-4'>Состав команды</h2>
			<div className='bg-gray-900 rounded-xl border border-gray-800 overflow-hidden'>
				<table className='w-full text-left'>
					<thead className='bg-gray-950 text-gray-400 border-b border-gray-800'>
						<tr>
							<th className='p-4'>Корзина</th>
							<th className='p-4'>Игрок</th>
							<th className='p-4 text-right'>Цена</th>
							<th className='p-4 text-right'>Очки</th>
						</tr>
					</thead>
					<tbody className='divide-y divide-gray-800'>
						{selections
							// Здесь TS теперь знает, что s.players.baskets существует и является объектом
							?.sort(
								(a, b) =>
									a.players.baskets.sort_order - b.players.baskets.sort_order
							)
							.map((s, idx) => (
								<tr key={idx} className='hover:bg-gray-800/30'>
									<td className='p-4 text-gray-400'>
										{s.players.baskets.name}
									</td>
									<td className='p-4 font-medium'>{s.players.name}</td>
									<td className='p-4 text-right font-mono text-yellow-600'>
										{s.players.cost}
									</td>
									<td className='p-4 text-right font-bold text-blue-400'>
										{s.players.points}
									</td>
								</tr>
							))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
