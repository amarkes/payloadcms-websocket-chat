/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Media } from '@/payload-types'
import AppShell from '@/components/layout/AppShell'
import SettingsPanel from '@/components/settings/SettingsPanel'

export default async function SettingsPage() {
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
    <AppShell username={fullUser.username ?? user.email} avatarUrl={avatarUrl}>
      <SettingsPanel email={user.email} username={fullUser.username} />
    </AppShell>
  )
}
