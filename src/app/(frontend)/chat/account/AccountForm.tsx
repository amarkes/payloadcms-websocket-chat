'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AccountForm({
  initialAvatarUrl,
  initialBirthDate,
  initialEmail,
  initialEnableMessageObfuscation,
  initialName,
  initialSex,
}: {
  initialAvatarUrl: string | null
  initialBirthDate: string
  initialEmail: string
  initialEnableMessageObfuscation: boolean
  initialName: string
  initialSex: string
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    birthDate: initialBirthDate ? initialBirthDate.slice(0, 10) : '',
    email: initialEmail,
    enableMessageObfuscation: initialEnableMessageObfuscation,
    name: initialName,
    password: '',
    sex: initialSex,
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(initialAvatarUrl)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [logoutLoading, setLogoutLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const payload = new FormData()
      payload.set('name', form.name)
      payload.set('email', form.email)
      payload.set('sex', form.sex)
      payload.set('birthDate', form.birthDate)
      payload.set('password', form.password)
      payload.set('enableMessageObfuscation', String(form.enableMessageObfuscation))

      if (avatarFile) {
        payload.set('avatar', avatarFile)
      }

      const response = await fetch('/api/chat-auth/account', {
        method: 'PATCH',
        body: payload,
        credentials: 'same-origin',
      })

      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel atualizar a conta.')
      }

      setMessage(data.message || 'Conta atualizada com sucesso.')
      setForm((current) => ({ ...current, password: '' }))
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel atualizar a conta.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    setLogoutLoading(true)

    try {
      await fetch('/api/chat-auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      })

      router.push('/chat')
      router.refresh()
    } finally {
      setLogoutLoading(false)
    }
  }

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null
    setAvatarFile(nextFile)

    if (!nextFile) {
      setAvatarPreviewUrl(initialAvatarUrl)
      return
    }

    setAvatarPreviewUrl(URL.createObjectURL(nextFile))
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px 16px',
        background:
          'radial-gradient(circle at top, rgba(31, 122, 236, 0.18), transparent 32%), #05070d',
        color: '#f5f7fb',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          padding: 24,
          borderRadius: 24,
          border: '1px solid rgba(148, 163, 184, 0.16)',
          background: 'rgba(11, 15, 25, 0.92)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Sua conta</h1>
            <p style={{ margin: '8px 0 0', color: '#94a3b8' }}>
              Atualize seus dados e, se quiser, defina uma nova senha.
            </p>
          </div>
          <Link href="/chat" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 14 }}>
            ← Voltar
          </Link>
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}
        {message && <div style={successBoxStyle}>{message}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: 14,
              borderRadius: 16,
              background: '#0f1724',
              border: '1px solid #243041',
            }}
          >
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt={form.name || form.email}
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontSize: 28,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {(form.name || form.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Avatar</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 10 }}>
                Escolha uma imagem para atualizar sua foto de perfil.
              </div>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 40,
                  padding: '0 14px',
                  borderRadius: 12,
                  border: '1px solid #334155',
                  background: '#111827',
                  color: '#e2e8f0',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Escolher avatar
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Seu nome"
            style={inputStyle}
          />
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Seu e-mail"
            style={inputStyle}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <select
              value={form.sex}
              onChange={(event) => setForm((current) => ({ ...current, sex: event.target.value }))}
              style={inputStyle}
            >
              <option value="">Sexo</option>
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
              <option value="prefer_not_to_say">Prefiro nao informar</option>
            </select>
            <input
              type="date"
              value={form.birthDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, birthDate: event.target.value }))
              }
              style={inputStyle}
            />
          </div>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Nova senha (opcional)"
            style={inputStyle}
          />
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 16px',
              borderRadius: 16,
              background: '#0f1724',
              border: '1px solid #243041',
              color: '#e2e8f0',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={form.enableMessageObfuscation}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  enableMessageObfuscation: event.target.checked,
                }))
              }
              style={{ width: 16, height: 16 }}
            />
            <div>
              <div style={{ fontWeight: 700 }}>Ofuscar mensagens</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>
                Exibe as mensagens borradas e revela apenas enquanto voce mantiver pressionado.
              </div>
            </div>
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            <button type="submit" disabled={loading} style={primaryButtonStyle}>
              {loading ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
            <button
              type="button"
              disabled={logoutLoading}
              onClick={handleLogout}
              style={secondaryButtonStyle}
            >
              {logoutLoading ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 48,
  borderRadius: 14,
  border: '1px solid #243041',
  background: '#0f1724',
  color: '#f5f7fb',
  padding: '0 14px',
  outline: 'none',
  fontSize: 15,
  boxSizing: 'border-box',
}

const primaryButtonStyle: React.CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '0 18px',
}

const secondaryButtonStyle: React.CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: '1px solid #334155',
  background: '#111827',
  color: '#e2e8f0',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  padding: '0 18px',
}

const errorBoxStyle: React.CSSProperties = {
  marginBottom: 14,
  padding: '10px 12px',
  borderRadius: 12,
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid rgba(239, 68, 68, 0.35)',
  color: '#fecaca',
  fontSize: 14,
}

const successBoxStyle: React.CSSProperties = {
  marginBottom: 14,
  padding: '10px 12px',
  borderRadius: 12,
  background: 'rgba(34, 197, 94, 0.12)',
  border: '1px solid rgba(34, 197, 94, 0.3)',
  color: '#bbf7d0',
  fontSize: 14,
}
