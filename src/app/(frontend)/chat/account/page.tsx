import { redirect } from 'next/navigation'

import type { Media, User } from '@/payload-types'
import AccountForm from './AccountForm'
import { getAuthenticatedUser } from '@/lib/chat-auth'

export default async function ChatAccountPage() {
  const { payload, user } = await getAuthenticatedUser()

  if (!user) {
    redirect('/chat')
  }

  const fullUser = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 1,
    overrideAccess: false,
    user,
  })) as User

  const avatarUrl =
    fullUser.avatar && typeof fullUser.avatar === 'object'
      ? `/api/media/file/${(fullUser.avatar as Media).filename}`
      : null

  return (
    <AccountForm
      initialAvatarUrl={avatarUrl}
      initialBirthDate={fullUser.birthDate || ''}
      initialEmail={fullUser.email}
      initialEnableMessageObfuscation={Boolean(
        (fullUser as User & { enableMessageObfuscation?: boolean | null }).enableMessageObfuscation,
      )}
      initialName={fullUser.name}
      initialSex={fullUser.sex || ''}
    />
  )
}
