import { test, expect } from '@playwright/test'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

const primaryUser = {
  email: 'social-primary@payloadcms.com',
  name: 'Primary User',
  password: 'password123',
  username: 'social-primary',
}

const targetUser = {
  email: 'social-target@payloadcms.com',
  name: 'Target User',
  password: 'password123',
  username: 'social-target',
}

let targetPostId: number

async function cleanupSeedData() {
  const payload = await getPayload({ config })
  const existingUsers = await payload.find({
    collection: 'users',
    where: {
      email: {
        in: [primaryUser.email, targetUser.email],
      },
    },
    overrideAccess: true,
    depth: 0,
    limit: 10,
  })
  const existingUserIds = existingUsers.docs.map((user) => Number(user.id)).filter(Number.isFinite)

  await payload.delete({
    collection: 'reactions',
    where: {
      targetType: {
        equals: 'post',
      },
    },
    overrideAccess: true,
  })

  await payload.delete({
    collection: 'posts',
    where: {
      or: [
        { caption: { contains: 'critical flow seed' } },
        { caption: { contains: 'critical flow post' } },
      ],
    },
    overrideAccess: true,
  })

  await payload.delete({
    collection: 'follows',
    where: existingUserIds.length
      ? {
          or: [
            { follower: { in: existingUserIds } },
            { following: { in: existingUserIds } },
          ],
        }
      : {
          id: {
            exists: false,
          },
        },
    overrideAccess: true,
  })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        in: [primaryUser.email, targetUser.email],
      },
    },
    overrideAccess: true,
  })
}

async function seedSocialScenario() {
  const payload = await getPayload({ config })

  await cleanupSeedData()

  await payload.create({
    collection: 'users',
    data: primaryUser,
    overrideAccess: true,
    depth: 0,
  })

  const createdTarget = await payload.create({
    collection: 'users',
    data: targetUser,
    overrideAccess: true,
    depth: 0,
  })

  const seededPost = await (payload as any).create({
    collection: 'posts',
    data: {
      author: createdTarget.id,
      caption: 'critical flow seed post',
      visibility: 'public',
    },
    overrideAccess: true,
    depth: 0,
  })

  targetPostId = Number(seededPost.id)
}

test.describe('Frontend Critical Flows', () => {
  test.beforeAll(async () => {
    await seedSocialScenario()
  })

  test.afterAll(async () => {
    await cleanupSeedData()
  })

  test('can create a post, follow a user, and like a followed post', async ({ page }) => {
    const postCaption = `critical flow post ${Date.now()}`

    await page.goto('http://localhost:3000')
    await page.getByPlaceholder('Seu e-mail').fill(primaryUser.email)
    await page.getByPlaceholder('Sua senha').fill(primaryUser.password)
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click()

    await page.waitForURL('http://localhost:3000/')

    await page.goto('http://localhost:3000/feed/new')
    await page.getByPlaceholder('O que voce quer compartilhar?').fill(postCaption)
    await page.getByRole('button', { name: 'Publicar' }).click()
    await page.waitForURL('http://localhost:3000/feed')

    await page.goto(`http://localhost:3000/u/${primaryUser.username}`)
    await expect(page.getByText(postCaption.slice(0, 24))).toBeVisible()

    await page.goto(`http://localhost:3000/u/${targetUser.username}`)
    const followButton = page.getByRole('button', { name: /Alternar seguir usuario/ })
    await followButton.click()
    await expect(followButton).toHaveText('Seguindo')

    await page.goto('http://localhost:3000/feed')
    const targetPostCard = page.getByTestId(`post-card-${targetPostId}`)
    await expect(targetPostCard).toContainText('critical flow seed post')

    const likeButton = targetPostCard.getByRole('button', { name: `Curtir post ${targetPostId}` })
    await likeButton.click()
    await expect(likeButton).toContainText('1')
  })
})
