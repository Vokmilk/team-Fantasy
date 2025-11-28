'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Navigation() {
	const pathname = usePathname()

	const links = [
		{ href: '/', label: 'Кабинет' },
		{ href: '/picks', label: 'Таблица' },
		{ href: '/stats', label: 'Статистика' },
		{ href: '/bingo', label: 'Бинго' },
	]

	return (
		<nav className='flex items-center gap-1 bg-gray-950/50 p-1 rounded-lg border border-gray-800'>
			{links.map(link => {
				const isActive = pathname === link.href
				return (
					<Link
						key={link.href}
						href={link.href}
						className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
              ${
								isActive
									? 'bg-gray-800 text-white shadow-sm'
									: 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
							}`}
					>
						{link.label}
					</Link>
				)
			})}
		</nav>
	)
}
