'use client'

import { login, resetPassword, signup } from '@/app/actions'
import { useState } from 'react'

export default function LoginPage() {
	const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
	const [message, setMessage] = useState('')
	// Стейт для показа экрана успеха
	const [showEmailSent, setShowEmailSent] = useState(false)

	const handleSubmit = async (formData: FormData) => {
		setMessage('')

		// --- ЛОГИКА СБРОСА ПАРОЛЯ ---
		if (mode === 'reset') {
			const email = formData.get('email') as string
			const res = await resetPassword(email)

			if (res.success) {
				// Показываем большой экран успеха
				setShowEmailSent(true)
			} else {
				setMessage(res.error || 'Ошибка при отправке')
			}
			return
		}

		// --- ЛОГИКА ВХОДА И РЕГИСТРАЦИИ ---
		const action = mode === 'login' ? login : signup
		const res = await action(formData)

		if (res?.error) {
			setMessage(res.error)
		} else if (mode === 'signup') {
			// Показываем большой экран успеха после регистрации
			setShowEmailSent(true)
		}
	}

	// --- ЭКРАН УСПЕХА (ОБЩИЙ ДЛЯ РЕГИСТРАЦИИ И СБРОСА) ---
	if (showEmailSent) {
		const isSignup = mode === 'signup'

		return (
			<div className='flex min-h-screen items-center justify-center bg-gray-950 text-white p-4'>
				<div className='max-w-md w-full bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl text-center'>
					<div className='w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6'>
						{/* Иконка письма/галочки */}
						<svg
							className='w-10 h-10 text-green-500'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth='2'
								d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
							></path>
						</svg>
					</div>

					<h1 className='text-3xl font-bold mb-4'>
						{isSignup ? 'Письмо отправлено!' : 'Проверьте почту'}
					</h1>

					<p className='text-gray-400 mb-8 text-lg leading-relaxed'>
						{isSignup
							? 'Мы отправили ссылку для подтверждения регистрации.'
							: 'Мы отправили ссылку для сброса пароля.'}
						<br />
						<span className='text-white font-medium block mt-2'>
							Не забудьте проверить папку "Спам".
						</span>
					</p>

					<button
						onClick={() => {
							setShowEmailSent(false)
							setMode('login')
							setMessage('')
						}}
						className='w-full bg-gray-800 hover:bg-gray-700 py-3 rounded-lg font-bold transition text-gray-200'
					>
						Вернуться ко входу
					</button>
				</div>
			</div>
		)
	}

	// --- ОБЫЧНАЯ ФОРМА ---
	const getTitle = () => {
		if (mode === 'login') return 'Вход'
		if (mode === 'signup') return 'Регистрация'
		return 'Восстановление'
	}

	return (
		<div className='flex min-h-screen items-center justify-center bg-gray-950 text-white'>
			<form
				action={handleSubmit}
				className='flex flex-col gap-4 w-96 border border-gray-800 p-8 rounded-xl bg-gray-900 shadow-2xl'
			>
				<h1 className='text-3xl font-bold text-center mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent'>
					{getTitle()}
				</h1>

				{/* --- ПОЛЯ ДЛЯ РЕГИСТРАЦИИ --- */}
				{mode === 'signup' && (
					<input
						name='username'
						placeholder='Никнейм (Username)'
						className='input-dark'
						required
					/>
				)}

				{/* --- ПОЛЯ ДЛЯ ВХОДА --- */}
				{mode === 'login' && (
					<>
						<input
							name='login'
							placeholder='Email или Username'
							className='input-dark'
							required
						/>
						<input
							name='password'
							type='password'
							placeholder='Пароль'
							className='input-dark'
							required
						/>
						<div className='text-right'>
							<button
								type='button'
								onClick={() => {
									setMode('reset')
									setMessage('')
								}}
								className='text-xs text-blue-400 hover:text-blue-300'
							>
								Забыли пароль?
							</button>
						</div>
					</>
				)}

				{/* --- ПОЛЯ ДЛЯ РЕГИСТРАЦИИ --- */}
				{mode === 'signup' && (
					<>
						<input
							name='email'
							type='email'
							placeholder='Email'
							className='input-dark'
							required
						/>
						<input
							name='password'
							type='password'
							placeholder='Пароль'
							className='input-dark'
							required
						/>
					</>
				)}

				{/* --- ПОЛЯ ДЛЯ СБРОСА ПАРОЛЯ --- */}
				{mode === 'reset' && (
					<>
						<p className='text-sm text-gray-400 text-center mb-2'>
							Введите email, указанный при регистрации. Мы отправим ссылку для
							сброса.
						</p>
						<input
							name='email'
							type='email'
							placeholder='Ваш Email'
							className='input-dark'
							required
						/>
					</>
				)}

				{/* --- КНОПКА ДЕЙСТВИЯ --- */}
				<button className='bg-blue-600 py-3 rounded-lg font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-900/20 mt-2'>
					{mode === 'login'
						? 'Войти'
						: mode === 'signup'
						? 'Создать аккаунт'
						: 'Сбросить пароль'}
				</button>

				{/* --- ПЕРЕКЛЮЧАТЕЛИ РЕЖИМОВ --- */}
				<div className='text-center text-gray-400 text-sm mt-4 space-y-2'>
					{mode === 'login' && (
						<p>
							Нет аккаунта?
							<button
								type='button'
								onClick={() => {
									setMode('signup')
									setMessage('')
								}}
								className='text-blue-400 ml-2 hover:underline'
							>
								Зарегистрироваться
							</button>
						</p>
					)}

					{mode === 'signup' && (
						<p>
							Уже есть аккаунт?
							<button
								type='button'
								onClick={() => {
									setMode('login')
									setMessage('')
								}}
								className='text-blue-400 ml-2 hover:underline'
							>
								Войти
							</button>
						</p>
					)}

					{mode === 'reset' && (
						<button
							type='button'
							onClick={() => {
								setMode('login')
								setMessage('')
							}}
							className='text-gray-500 hover:text-white underline'
						>
							Вернуться ко входу
						</button>
					)}
				</div>

				{/* --- ОШИБКИ (Успех теперь в отдельном экране) --- */}
				{message && (
					<div className='p-3 border rounded text-sm text-center bg-red-900/50 border-red-800 text-red-200'>
						{message}
					</div>
				)}
			</form>
		</div>
	)
}
