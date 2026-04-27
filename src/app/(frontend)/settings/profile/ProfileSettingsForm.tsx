'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

interface ProfileSettingsFormProps {
  initialName: string
  initialEmail: string
  initialUsername: string
  initialBio: string
  initialWebsite: string
  initialIsPrivate: boolean
  initialSex: string
  initialBirthDate: string
  initialEnableMessageObfuscation: boolean
  initialAvatarUrl: string | null
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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  height: 'auto',
  minHeight: 80,
  padding: '12px 14px',
  resize: 'vertical' as const,
}

export default function ProfileSettingsForm({
  initialName,
  initialEmail,
  initialUsername,
  initialBio,
  initialWebsite,
  initialIsPrivate,
  initialSex,
  initialBirthDate,
  initialEnableMessageObfuscation,
  initialAvatarUrl,
}: ProfileSettingsFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const nameParts = initialName.trim().split(/\s+/)
  const initialFirstName = nameParts[0] ?? ''
  const initialLastName = nameParts.slice(1).join(' ')
  const [form, setForm] = useState({
    firstName: initialFirstName,
    lastName: initialLastName,
    email: initialEmail,
    username: initialUsername,
    bio: initialBio,
    website: initialWebsite,
    isPrivate: initialIsPrivate,
    sex: initialSex,
    birthDate: initialBirthDate ? initialBirthDate.slice(0, 10) : '',
    enableMessageObfuscation: initialEnableMessageObfuscation,
    password: '',
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setSuccess('')
    setError('')

    try {
      const fd = new FormData()
      fd.set('name', `${form.firstName} ${form.lastName}`.trim())
      fd.set('email', form.email)
      fd.set('username', form.username)
      fd.set('bio', form.bio)
      fd.set('website', form.website)
      fd.set('isPrivate', String(form.isPrivate))
      fd.set('sex', form.sex)
      fd.set('birthDate', form.birthDate)
      fd.set('enableMessageObfuscation', String(form.enableMessageObfuscation))
      if (form.password) fd.set('password', form.password)
      if (avatarFile) fd.set('avatar', avatarFile)

      const res = await fetch('/api/social/profile', {
        method: 'PATCH',
        body: fd,
        credentials: 'same-origin',
      })

      const data = (await res.json()) as { message?: string }

      if (!res.ok) throw new Error(data.message || 'Erro ao salvar.')

      setSuccess(data.message || 'Perfil atualizado.')
      setAvatarFile(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  const displayName = `${form.firstName} ${form.lastName}`.trim() || initialName

  return (
    <div
      style={{
        padding: 28,
        borderRadius: 24,
        border: '1px solid rgba(148, 163, 184, 0.14)',
        background: 'rgba(11, 15, 25, 0.92)',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.4)',
      }}
    >
      <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Editar perfil</h2>

      {success && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#bbf7d0',
            fontSize: 14,
          }}
        >
          {success}
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fecaca',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid #243041',
              background: '#111827',
              cursor: 'pointer',
              flexShrink: 0,
              position: 'relative',
              padding: 0,
            }}
          >
            {avatarPreview ? (
              <Image
                src={avatarPreview}
                alt={displayName}
                fill
                sizes="72px"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <span style={{ color: '#f5f7fb', fontSize: 28, fontWeight: 700 }}>
                {displayName.charAt(0).toUpperCase() || '?'}
              </span>
            )}
          </button>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'none',
                border: '1px solid #334155',
                color: '#94a3b8',
                borderRadius: 10,
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Trocar foto
            </button>
            <p style={{ color: '#475569', fontSize: 11, margin: '4px 0 0' }}>
              JPG, PNG ou GIF
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
              Nome
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              required
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
              Sobrenome
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            style={inputStyle}
          />
        </div>

        {/* Username */}
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
            Username
          </label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            required
            placeholder="ex: joao_silva"
            style={inputStyle}
          />
          <p style={{ color: '#475569', fontSize: 11, margin: '4px 0 0' }}>
            3-30 caracteres, apenas letras, numeros e _.
          </p>
        </div>

        {/* Bio */}
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
            Bio
          </label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="Conte um pouco sobre voce..."
            style={textareaStyle}
          />
        </div>

        {/* Website */}
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
            Website
          </label>
          <input
            type="text"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            placeholder="https://seusite.com"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
              Sexo
            </label>
            <select
              value={form.sex}
              onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Nao informar</option>
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
              <option value="prefer_not_to_say">Prefiro nao informar</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
              Data de nascimento
            </label>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
            Nova senha
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Deixe em branco para manter a senha atual"
            style={inputStyle}
          />
          <p style={{ color: '#475569', fontSize: 11, margin: '4px 0 0' }}>
            Minimo de 8 caracteres.
          </p>
        </div>

        {/* Private */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={form.isPrivate}
            onChange={(e) => setForm((f) => ({ ...f, isPrivate: e.target.checked }))}
            style={{ width: 18, height: 18, accentColor: '#0070f3' }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Perfil privado</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Novos seguidores precisam de aprovacao.
            </div>
          </div>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={form.enableMessageObfuscation}
            onChange={(e) =>
              setForm((f) => ({ ...f, enableMessageObfuscation: e.target.checked }))
            }
            style={{ width: 18, height: 18, accentColor: '#0070f3' }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Ofuscar mensagens</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Ativa a ofuscacao de mensagens quando disponivel.
            </div>
          </div>
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            height: 48,
            borderRadius: 14,
            border: 'none',
            background: loading ? '#1e3a5f' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 4,
          }}
        >
          {loading ? 'Salvando...' : 'Salvar alteracoes'}
        </button>
      </form>
    </div>
  )
}
