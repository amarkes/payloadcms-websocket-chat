import Link from 'next/link'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import AppShell from '@/components/layout/AppShell'
import NewReelForm from './NewReelForm'

export default async function NewReelPage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/')

  const fullUser = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 1,
    overrideAccess: true,
  })) as User & { username?: string | null; avatar?: { filename?: string | null } | null }

  const avatarUrl = fullUser.avatar?.filename
    ? `/api/media/file/${fullUser.avatar.filename}`
    : null

  return (
    <AppShell username={fullUser.username ?? user.email} avatarUrl={avatarUrl}>
      <div className="mb-4">
        <Link href="/reels" className="text-sm font-semibold text-neutral-500 hover:text-primary">
          Voltar para reels
        </Link>
      </div>

      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold text-neutral-900">Novo reel</h1>
        <p className="text-sm text-neutral-500">Publique um video curto para seus seguidores.</p>
      </div>

      <NewReelForm />
    </AppShell>
  )
}

