'use client'

import { FormEvent, useState } from 'react'

export default function AdminLogin({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '로그인하지 못했습니다.')
      // A full navigation clears any previously cached admin content.
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인하지 못했습니다. 다시 시도해 주세요.')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-white space-y-6">
        <div>
          <h1 className="text-2xl font-bold">관리자 로그인</h1>
          <p className="mt-2 text-sm text-gray-400">콘텐츠를 관리하려면 비밀번호를 입력해 주세요.</p>
        </div>
        {!configured ? (
          <p role="status" className="text-sm text-gray-300">관리자 접근이 잠겨 있습니다. 서버에서 관리자 비밀번호를 설정해 주세요.</p>
        ) : (
          <form onSubmit={handleSubmit} className="mp-sensitive space-y-4" data-clarity-mask="true">
            <div>
              <label htmlFor="admin-password" className="block text-sm mb-2">관리자 비밀번호</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={1024}
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError('') }}
                aria-describedby={error ? 'admin-login-error' : undefined}
                aria-invalid={Boolean(error)}
                className="mp-sensitive w-full rounded-lg border border-gray-600 bg-transparent px-4 py-3 focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
            {error && <p id="admin-login-error" role="alert" className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-white px-4 py-3 font-medium text-black disabled:opacity-50">
              {isSubmitting ? '확인 중…' : '로그인'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
