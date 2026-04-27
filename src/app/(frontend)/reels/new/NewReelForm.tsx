'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useRef, useState } from 'react'

export default function NewReelForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public')
  const [video, setVideo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleVideoChange(file?: File) {
    if (!file) return
    setVideo(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!video || loading) return

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.set('caption', caption)
      formData.set('visibility', visibility)
      formData.set('video', video)

      const res = await fetch('/api/social/reel', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })
      const data = (await res.json()) as { id?: number; message?: string }

      if (!res.ok || !data.id) throw new Error(data.message || 'Erro ao publicar reel.')

      router.push('/reels')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar reel.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-neutral-300/20 bg-neutral-200 p-5"
    >
      <div className="mb-4">
        <label className="mb-2 block text-sm font-semibold text-neutral-700">Video</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300/40 bg-neutral-100 text-sm font-semibold text-neutral-500 hover:border-primary/40 hover:text-primary"
        >
          {previewUrl ? (
            <video src={previewUrl} controls className="h-full max-h-[520px] w-full object-contain" />
          ) : (
            'Selecionar video'
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => handleVideoChange(event.target.files?.[0])}
        />
      </div>

      <div className="mb-4">
        <label className="mb-2 block text-sm font-semibold text-neutral-700">Legenda</label>
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          rows={4}
          placeholder="Escreva uma legenda..."
          className="w-full resize-y rounded-xl border border-neutral-300/20 bg-neutral-100 px-4 py-3 text-sm text-neutral-800 outline-none focus:border-primary/40"
        />
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-sm font-semibold text-neutral-700">Visibilidade</label>
        <div className="grid grid-cols-3 gap-2">
          {(['public', 'followers', 'private'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setVisibility(value)}
              className={`h-10 rounded-xl border text-sm font-semibold ${
                visibility === value
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-neutral-300/20 bg-neutral-100 text-neutral-500'
              }`}
            >
              {value === 'public' ? 'Publico' : value === 'followers' ? 'Seguidores' : 'Privado'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={!video || loading}
        className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-neutral disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Publicando...' : 'Publicar reel'}
      </button>
    </form>
  )
}

