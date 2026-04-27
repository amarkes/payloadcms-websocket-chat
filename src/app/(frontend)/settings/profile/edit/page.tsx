/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Media, User } from '@/payload-types'
import AppShell from '@/components/layout/AppShell'
import ProfileSettingsForm from '../ProfileSettingsForm'

export default async function EditProfilePage() {
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
  })) as User & {
    username?: string | null
    bio?: string | null
    website?: string | null
    isPrivate?: boolean | null
    avatar?: { filename?: string | null } | null
  }

  const avatarUrl =
    fullUser.avatar && typeof fullUser.avatar === 'object'
      ? `/api/media/file/${(fullUser.avatar as Media).filename}`
      : null

  return (
    <AppShell username={fullUser.username ?? user.email} avatarUrl={avatarUrl}>
      <div className="max-w-lg">
        <h1 className="text-xl font-bold text-neutral-900 mb-6">Editar Perfil</h1>
        <ProfileSettingsForm
          initialName={fullUser.name || ''}
          initialEmail={fullUser.email || user.email}
          initialUsername={fullUser.username || ''}
          initialBio={fullUser.bio || ''}
          initialWebsite={fullUser.website || ''}
          initialIsPrivate={Boolean(fullUser.isPrivate)}
          initialSex={fullUser.sex || ''}
          initialBirthDate={fullUser.birthDate || ''}
          initialEnableMessageObfuscation={Boolean(fullUser.enableMessageObfuscation)}
          initialAvatarUrl={avatarUrl}
        />
      </div>
    </AppShell>
  )
}
