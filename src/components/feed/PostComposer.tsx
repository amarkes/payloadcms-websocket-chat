'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ImageIcon, Video, Smile, Gift } from 'lucide-react'

type Visibility = 'public' | 'followers' | 'private'

interface PostComposerProps {
  avatarUrl?: string | null
  username?: string | null
}

export default function PostComposer({ avatarUrl, username }: PostComposerProps) {
  const t = useTranslations('composer')
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState(false)

  const initial = username?.[0]?.toUpperCase() ?? '?'

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, 10)
    if (!selected.length) return
    setFiles((prev) => [...prev, ...selected].slice(0, 10))
    setPreviews((prev) =>
      [...prev, ...selected.map((f) => URL.createObjectURL(f))].slice(0, 10),
    )
    e.target.value = ''
  }

  function removePreview(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!caption.trim() && files.length === 0) {
      setError(t('errorEmpty'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.set('caption', caption.trim())
      fd.set('visibility', visibility)
      for (const file of files) fd.append('media', file)

      const res = await fetch('/api/social/post', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(data.message || 'Erro')

      setCaption('')
      setFiles([])
      setPreviews([])
      setFocused(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-300/20 bg-neutral-200 p-4 mb-4">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="shrink-0">
            {avatarUrl ? (
              <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/30">
                <Image
                  src={avatarUrl}
                  alt={username ?? ''}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-tertiary border border-primary/20 flex items-center justify-center text-neutral-900 font-bold text-sm">
                {initial}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="flex-1 min-w-0">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder={t('placeholder')}
              rows={focused ? 3 : 1}
              className="w-full bg-transparent text-neutral-800 placeholder-neutral-500 resize-none outline-none text-sm leading-relaxed transition-all duration-200"
            />

            {/* Media previews */}
            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-neutral-300/20">
                    <Image src={src} alt="" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removePreview(i)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-neutral-100/80 text-neutral-900 text-xs flex items-center justify-center leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="text-red-400 text-xs mt-1">{error}</p>
            )}

            {/* Visibility selector (only when focused) */}
            {focused && (
              <div className="flex gap-1.5 mt-3">
                {(['public', 'followers', 'private'] as Visibility[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={[
                      'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                      visibility === v
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-neutral-300/20 text-neutral-600 hover:border-neutral-500/30',
                    ].join(' ')}
                  >
                    {t(`visibility.${v}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Divider + actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-300/20">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            {[
              { icon: ImageIcon, label: t('addImage'), action: () => fileInputRef.current?.click() },
              { icon: Video, label: t('addVideo'), action: () => fileInputRef.current?.click() },
              { icon: Smile, label: t('addEmoji'), action: () => {} },
              { icon: Gift, label: t('addGif'), action: () => {} },
            ].map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                aria-label={label}
                className="p-2 rounded-lg text-neutral-500 hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Icon size={16} />
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || (!caption.trim() && files.length === 0)}
            className="px-5 py-2 rounded-xl bg-primary text-neutral font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? t('posting') : t('post')}
          </button>
        </div>
      </form>
    </div>
  )
}
