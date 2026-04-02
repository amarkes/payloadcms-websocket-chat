'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Mode = 'login' | 'register' | 'forgot'

type RequestState = {
  error: string
  loading: boolean
  success: string
}

const initialRequestState: RequestState = {
  error: '',
  loading: false,
  success: '',
}

export default function ChatAuthScreen() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [requestState, setRequestState] = useState<RequestState>(initialRequestState)
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' })
  const [resetForm, setResetForm] = useState({ email: '', code: '', password: '' })

  async function submitJson(url: string, body: Record<string, string>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    })

    const data = (await response.json().catch(() => ({}))) as { message?: string }

    if (!response.ok) {
      throw new Error(data.message || 'Nao foi possivel concluir a solicitacao.')
    }

    return data
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestState({ ...initialRequestState, loading: true })

    try {
      const data = await submitJson('/api/chat-auth/login', loginForm)
      setRequestState({ error: '', loading: false, success: data.message || 'Login realizado.' })
      router.refresh()
    } catch (error) {
      setRequestState({
        error: error instanceof Error ? error.message : 'Nao foi possivel entrar.',
        loading: false,
        success: '',
      })
    }
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestState({ ...initialRequestState, loading: true })

    try {
      const data = await submitJson('/api/chat-auth/register', registerForm)
      setRequestState({ error: '', loading: false, success: data.message || 'Conta criada.' })
      router.refresh()
    } catch (error) {
      setRequestState({
        error: error instanceof Error ? error.message : 'Nao foi possivel criar a conta.',
        loading: false,
        success: '',
      })
    }
  }

  async function handleRequestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestState({ ...initialRequestState, loading: true })

    try {
      const data = await submitJson('/api/chat-auth/request-reset', {
        email: resetForm.email,
      })
      setResetStep('confirm')
      setRequestState({
        error: '',
        loading: false,
        success: data.message || 'Codigo enviado.',
      })
    } catch (error) {
      setRequestState({
        error: error instanceof Error ? error.message : 'Nao foi possivel enviar o codigo.',
        loading: false,
        success: '',
      })
    }
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestState({ ...initialRequestState, loading: true })

    try {
      const data = await submitJson('/api/chat-auth/reset-password', resetForm)
      setRequestState({
        error: '',
        loading: false,
        success: data.message || 'Senha redefinida com sucesso.',
      })
      router.refresh()
    } catch (error) {
      setRequestState({
        error: error instanceof Error ? error.message : 'Nao foi possivel redefinir a senha.',
        loading: false,
        success: '',
      })
    }
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
          maxWidth: 460,
          padding: 24,
          borderRadius: 24,
          border: '1px solid rgba(148, 163, 184, 0.16)',
          background: 'rgba(11, 15, 25, 0.92)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(37, 99, 235, 0.16)',
              color: '#93c5fd',
              fontSize: 12,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Chat
          </div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>Entre para conversar</h1>
          <p style={{ margin: '10px 0 0', color: '#94a3b8', lineHeight: 1.5 }}>
            Faça login, crie sua conta ou recupere a senha com um codigo enviado por e-mail.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            padding: 6,
            borderRadius: 16,
            background: '#0f1724',
            marginBottom: 18,
          }}
        >
          {[
            { id: 'login', label: 'Entrar' },
            { id: 'register', label: 'Criar conta' },
            { id: 'forgot', label: 'Esqueci a senha' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setMode(tab.id as Mode)
                setRequestState(initialRequestState)
              }}
              style={{
                height: 42,
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                background: mode === tab.id ? '#1f7aec' : 'transparent',
                color: '#f5f7fb',
                fontWeight: 600,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {requestState.error && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fecaca',
              fontSize: 14,
            }}
          >
            {requestState.error}
          </div>
        )}

        {requestState.success && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#bbf7d0',
              fontSize: 14,
            }}
          >
            {requestState.success}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12 }}>
            <input
              type="email"
              placeholder="Seu e-mail"
              value={loginForm.email}
              onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Sua senha"
              value={loginForm.password}
              onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              style={inputStyle}
            />
            <button type="submit" disabled={requestState.loading} style={primaryButtonStyle}>
              {requestState.loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'grid', gap: 12 }}>
            <input
              type="text"
              placeholder="Seu nome"
              value={registerForm.name}
              onChange={(event) =>
                setRegisterForm((current) => ({ ...current, name: event.target.value }))
              }
              style={inputStyle}
            />
            <input
              type="email"
              placeholder="Seu e-mail"
              value={registerForm.email}
              onChange={(event) =>
                setRegisterForm((current) => ({ ...current, email: event.target.value }))
              }
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Crie uma senha"
              value={registerForm.password}
              onChange={(event) =>
                setRegisterForm((current) => ({ ...current, password: event.target.value }))
              }
              style={inputStyle}
            />
            <button type="submit" disabled={requestState.loading} style={primaryButtonStyle}>
              {requestState.loading ? 'Criando...' : 'Criar conta'}
            </button>
          </form>
        )}

        {mode === 'forgot' && resetStep === 'request' && (
          <form onSubmit={handleRequestReset} style={{ display: 'grid', gap: 12 }}>
            <input
              type="email"
              placeholder="Seu e-mail"
              value={resetForm.email}
              onChange={(event) => setResetForm((current) => ({ ...current, email: event.target.value }))}
              style={inputStyle}
            />
            <button type="submit" disabled={requestState.loading} style={primaryButtonStyle}>
              {requestState.loading ? 'Enviando...' : 'Enviar codigo'}
            </button>
          </form>
        )}

        {mode === 'forgot' && resetStep === 'confirm' && (
          <form onSubmit={handleResetPassword} style={{ display: 'grid', gap: 12 }}>
            <input
              type="email"
              placeholder="Seu e-mail"
              value={resetForm.email}
              onChange={(event) => setResetForm((current) => ({ ...current, email: event.target.value }))}
              style={inputStyle}
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Codigo recebido por e-mail"
              value={resetForm.code}
              onChange={(event) => setResetForm((current) => ({ ...current, code: event.target.value }))}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Nova senha"
              value={resetForm.password}
              onChange={(event) =>
                setResetForm((current) => ({ ...current, password: event.target.value }))
              }
              style={inputStyle}
            />
            <button type="submit" disabled={requestState.loading} style={primaryButtonStyle}>
              {requestState.loading ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}
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
}

const primaryButtonStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
}
