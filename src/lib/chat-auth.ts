import { randomInt, createHash } from 'crypto'
import { spawn } from 'child_process'
import { promisify } from 'util'
import { getPayload } from 'payload'
import { generateExpiredPayloadCookie, generatePayloadCookie } from 'payload/shared'
import { headers as getHeaders } from 'next/headers'

import config from '@/payload.config'

const waitForChildClose = promisify((child: ReturnType<typeof spawn>, callback: (error?: Error | null) => void) => {
  child.on('error', callback)
  child.on('close', (code) => {
    if (code === 0) {
      callback(null)
      return
    }

    callback(new Error(`sendmail exited with code ${code}`))
  })
})

export async function getPayloadClient() {
  return getPayload({ config: await config })
}

export function hashResetCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export function generateResetCode() {
  return String(randomInt(100000, 1000000))
}

export function getResetCodeExpiration(minutes = 10) {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

export async function sendResetCodeEmail({
  code,
  email,
  name,
}: {
  code: string
  email: string
  name?: string | null
}) {
  const from = process.env.PAYLOAD_EMAIL_FROM || process.env.PAYLOAD_EMAIL_USER
  const host = process.env.PAYLOAD_EMAIL_HOST
  const port = process.env.PAYLOAD_EMAIL_PORT
  const user = process.env.PAYLOAD_EMAIL_USER
  const password = process.env.PAYLOAD_EMAIL_PASSWORD
  const isSecure = process.env.PAYLOAD_EMAIL_SECURE === 'true'

  if (!from || !host || !port || !user || !password) {
    throw new Error('Missing SMTP configuration for password reset email')
  }

  const message = [
    `From: ${from}`,
    `To: ${email}`,
    'Subject: Codigo de recuperacao do chat',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    `Ola${name ? `, ${name}` : ''}.`,
    '',
    `Seu codigo de recuperacao e: ${code}`,
    'Esse codigo expira em 10 minutos.',
    '',
    'Se voce nao solicitou a troca de senha, ignore este e-mail.',
    '',
  ].join('\n')

  const child = spawn('/usr/bin/curl', [
    '--silent',
    '--show-error',
    '--url',
    `${isSecure ? 'smtps' : 'smtp'}://${host}:${port}`,
    '--ssl-reqd',
    '--mail-from',
    from,
    '--mail-rcpt',
    email,
    '--user',
    `${user}:${password}`,
    '--upload-file',
    '-',
    '--crlf',
  ])

  child.stdin.write(message)
  child.stdin.end()

  await waitForChildClose(child)
}

export async function createAuthCookie(token?: string) {
  const payload = await getPayloadClient()
  const authConfig = payload.collections.users?.config.auth

  if (!authConfig || !token) {
    throw new Error('Users auth config not found')
  }

  return generatePayloadCookie({
    collectionAuthConfig: authConfig,
    cookiePrefix: payload.config.cookiePrefix,
    token,
  })
}

export async function createExpiredAuthCookie() {
  const payload = await getPayloadClient()
  const authConfig = payload.collections.users?.config.auth

  if (!authConfig) {
    throw new Error('Users auth config not found')
  }

  return generateExpiredPayloadCookie({
    collectionAuthConfig: authConfig,
    cookiePrefix: payload.config.cookiePrefix,
  })
}

export async function getAuthenticatedUser() {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  return { payload, user }
}
