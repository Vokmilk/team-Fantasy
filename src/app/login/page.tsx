'use client'

import { login, resetPassword, signup } from '@/app/actions'
import { useState } from 'react'

export default function LoginPage() {
	// Добавили режим 'reset'
	const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
	const [message, setMessage] = useState('')
	const [isSuccess, setIsSuccess] = useState(false) // Чтобы красить сообщение в зеленый

	const handleSubmit = async (formData: FormData) => {
		setMessage('')
		setIsSuccess(false)

		// Логика для восстановления пароля
		if (mode === 'reset') {
			const email = formData.get('email') as string
			const res = await resetPassword(email)

			if (res.success) {
				setIsSuccess(true)
				setMessage('Ссылка для сброса отправлена на ваш Email.')
			} else {
				setMessage(res.error || 'Ошибка при отправке')
			}
			return
		}

		// Логика для Входа и Регистрации
		const action = mode === 'login' ? login : signup
		const res = await action(formData)
		if (res?.error) setMessage(res.error)
	}

	// Заголовок формы
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

				{/* --- ПОЛЯ ДЛЯ РЕГИСТРАЦИИ (Email нужен отдельно) --- */}
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
						<p className='text-sm text-gray-400 text-center'>
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

				{/* --- КНОПКА ОТПРАВКИ --- */}
				<button className='bg-blue-600 py-3 rounded-lg font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-900/20 mt-2'>
					{mode === 'login'
						? 'Войти'
						: mode === 'signup'
						? 'Создать аккаунт'
						: 'Сбросить пароль'}
				</button>

				{/* --- ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ --- */}
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

				{/* --- СООБЩЕНИЯ ОБ ОШИБКАХ/УСПЕХЕ --- */}
				{message && (
					<div
						className={`p-3 border rounded text-sm text-center ${
							isSuccess
								? 'bg-green-900/50 border-green-800 text-green-200'
								: 'bg-red-900/50 border-red-800 text-red-200'
						}`}
					>
						{message}
					</div>
				)}
			</form>
		</div>
	)
}
