'use client'

import { login, signup, resetPassword } from '@/app/actions' // Убедись, что путь верный
import { useState } from 'react'

export default function LoginPage() {
  const [isReset, setIsReset] = useState(false)
  const [message, setMessage] = useState('')

  // Обертка для входа
  const handleLogin = async (formData: FormData) => {
    const result = await login(formData)
    if (result?.error) {
      setMessage(result.error)
    }
  }

  // Обертка для регистрации
  const handleSignup = async (formData: FormData) => {
    const result = await signup(formData)
    if (result?.error) {
      setMessage(result.error)
    }
  }

  if (isReset) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <form action={async (fd) => {
            const res = await resetPassword(fd.get('email') as string)
            setMessage(res.success ? 'Проверьте почту' : 'Ошибка: ' + res.error)
        }} className="flex flex-col gap-4 w-80">
          <h1 className="text-2xl font-bold">Восстановление</h1>
          <input name="email" placeholder="Email" className="p-2 rounded bg-gray-800 border border-gray-700" required />
          <button className="bg-blue-600 p-2 rounded hover:bg-blue-700">Сбросить пароль</button>
          <button type="button" onClick={() => setIsReset(false)} className="text-sm text-gray-400 underline">Назад</button>
          {message && <p className="text-red-400 text-sm text-center">{message}</p>}
        </form>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <form className="flex flex-col gap-4 w-80 border p-6 rounded-lg border-gray-700">
        <h1 className="text-2xl font-bold text-center">Fantasy League</h1>
        <input name="email" type="email" placeholder="Email" className="p-2 rounded bg-gray-800 border border-gray-700" required />
        <input name="password" type="password" placeholder="Пароль" className="p-2 rounded bg-gray-800 border border-gray-700" required />
        
        {/* Используем обертки handleLogin и handleSignup */}
        <button formAction={handleLogin} className="bg-green-600 p-2 rounded hover:bg-green-700 transition">Войти</button>
        <button formAction={handleSignup} className="bg-gray-700 p-2 rounded hover:bg-gray-600 transition">Регистрация</button>
        
        <button type="button" onClick={() => setIsReset(true)} className="text-sm text-center text-gray-400 hover:text-white">
          Забыли пароль?
        </button>
        
        {/* Отображение ошибок */}
        {message && <p className="text-red-500 text-sm text-center mt-2">{message}</p>}
      </form>
    </div>
  )
}