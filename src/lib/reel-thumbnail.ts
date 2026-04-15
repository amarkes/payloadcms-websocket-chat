import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import path from 'path'
import { writeFile } from 'fs/promises'

export async function createReelThumbnailFile({
  caption,
  reelId,
}: {
  caption?: string | null
  reelId: string | number
}) {
  const label = (caption?.trim() || `Reel ${reelId}`).slice(0, 48)
  const svg = `
    <svg width="720" height="1280" viewBox="0 0 720 1280" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="55%" stop-color="#1d4ed8" />
          <stop offset="100%" stop-color="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="720" height="1280" fill="url(#bg)" rx="48" />
      <circle cx="360" cy="430" r="120" fill="rgba(255,255,255,0.15)" />
      <polygon points="332,365 332,495 430,430" fill="#ffffff" />
      <text x="64" y="980" fill="#ffffff" font-size="42" font-family="Arial, sans-serif" font-weight="700">Reel</text>
      <text x="64" y="1042" fill="rgba(255,255,255,0.9)" font-size="30" font-family="Arial, sans-serif">${escapeForSvg(label)}</text>
    </svg>
  `.trim()

  const filePath = path.join(tmpdir(), `reel-thumbnail-${randomUUID()}.png`)
  const sharp = (await import('sharp')).default

  await sharp(Buffer.from(svg)).png().toFile(filePath)
  return filePath
}

function escapeForSvg(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
