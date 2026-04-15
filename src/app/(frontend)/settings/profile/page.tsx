/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Media } from '@/payload-types'
import ProfileSettingsForm from './ProfileSettingsForm'

export default async function SettingsProfilePage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/')

  const fullUser = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 1,
    overrideAccess: false,
    user,
  })) as any

  const avatarUrl =
    fullUser.avatar && typeof fullUser.avatar === 'object'
      ? `/api/media/file/${(fullUser.avatar as Media).filename}`
      : null

  return (
    <div
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at top, rgba(31, 122, 236, 0.10), transparent 30%), #05070d',
        color: '#f5f7fb',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Nav */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'rgba(5, 7, 13, 0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1f2a3a',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          height: 56,
          gap: 16,
        }}
      >
        <Link href="/" style={{ color: '#f5f7fb', textDecoration: 'none', fontWeight: 700, fontSize: 18 }}>
          ◎
        </Link>
        <span style={{ color: '#64748b', fontSize: 14 }}>Configuracoes do perfil</span>
        <div style={{ marginLeft: 'auto' }}>
          <Link
            href={`/u/${fullUser.username || user.email}`}
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}
          >
            ← Ver perfil
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 16px 48px' }}>
        <ProfileSettingsForm
          initialName={fullUser.name || ''}
          initialUsername={fullUser.username || ''}
          initialBio={fullUser.bio || ''}
          initialWebsite={fullUser.website || ''}
          initialIsPrivate={Boolean(fullUser.isPrivate)}
          initialAvatarUrl={avatarUrl}
        />
      </div>
    </div>
  )
}
