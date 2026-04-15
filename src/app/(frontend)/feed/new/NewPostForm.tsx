'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

type Visibility = 'public' | 'followers' | 'private'

const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: 'Publico',
  followers: 'Seguidores',
  private: 'Privado',
}

export default function NewPostForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, 10)
    if (selected.length === 0) return
    setFiles((prev) => [...prev, ...selected].slice(0, 10))
    setPreviews((prev) =>
      [...prev, ...selected.map((f) => URL.createObjectURL(f))].slice(0, 10),
    )
    e.target.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!caption.trim() && files.length === 0) {
      setError('Adicione uma legenda ou midia.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.set('caption', caption.trim())
      fd.set('visibility', visibility)
      for (const file of files) {
        fd.append('media', file)
      }
      const res = await fetch('/api/social/post', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(data.message || 'Erro ao criar post.')
      router.push('/feed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar post.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 20 }}>
      {/* Media preview grid */}
      {previews.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: 8,
          }}
        >
          {previews.map((src, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#0a0f1a',
              }}
            >
              {files[i]?.type.startsWith('video') ? (
                <video
                  src={src}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Image src={src} alt="" fill sizes="120px" style={{ objectFit: 'cover' }} />
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Media upload button */}
      {files.length < 10 && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            height: 48,
            borderRadius: 14,
            border: '2px dashed #243041',
            background: 'transparent',
            color: '#64748b',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 20 }}>📎</span>
          Adicionar fotos / videos
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Caption */}
      <div>
        <label
          style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}
        >
          Legenda
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="O que voce quer compartilhar?"
          rows={4}
          style={{
            width: '100%',
            borderRadius: 14,
            border: '1px solid #243041',
            background: '#0f1724',
            color: '#f5f7fb',
            padding: '12px 14px',
            fontSize: 15,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Visibility */}
      <div>
        <label
          style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}
        >
          Visibilidade
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['public', 'followers', 'private'] as Visibility[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 12,
                border: `1px solid ${visibility === v ? '#0070f3' : '#243041'}`,
                background: visibility === v ? 'rgba(0, 112, 243, 0.12)' : '#0f1724',
                color: visibility === v ? '#60a5fa' : '#64748b',
                fontSize: 13,
                fontWeight: visibility === v ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {VISIBILITY_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
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

      <button
        type="submit"
        disabled={loading}
        style={{
          height: 50,
          borderRadius: 14,
          border: 'none',
          background: loading ? '#1e3a5f' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: '#fff',
          fontSize: 15,
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Publicando...' : 'Publicar'}
      </button>
    </form>
  )
}
