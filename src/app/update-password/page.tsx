'use client'

import { updatePassword } from '@/app/actions'
import { useState } from 'react'

export default function UpdatePasswordPage() {
	const [message, setMessage] = useState('')

	const handleUpdate = async (formData: FormData) => {
		const res = await updatePassword(formData)
		if (res?.error) {
			setMessage(res.error)
		}
	}

	return (
		<div className='flex min-h-screen items-center justify-center bg-gray-950 text-white'>
			<form
				action={handleUpdate}
				className='flex flex-col gap-4 w-80 border p-6 rounded-lg border-gray-800 bg-gray-900'
			>
				<h1 className='text-2xl font-bold text-center'>Новый пароль</h1>
				<p className='text-sm text-gray-400 text-center'>
					Придумайте новый пароль для входа
				</p>

				<input
					name='password'
					type='password'
					placeholder='Новый пароль'
					className='p-3 rounded bg-gray-950 border border-gray-700 focus:border-blue-500 outline-none'
					required
					minLength={6}
				/>

				<button className='bg-blue-600 p-3 rounded font-bold hover:bg-blue-500 transition'>
					Сохранить пароль
				</button>

				{message && (
					<p className='text-red-400 text-sm text-center'>{message}</p>
				)}
			</form>
		</div>
	)
}
