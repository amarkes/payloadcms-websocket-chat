import { Plus_Jakarta_Sans, Spline_Sans } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import React from 'react'
import './styles.css'

const splineSans = Spline_Sans({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata = {
  description: 'VibeStream — sua rede social.',
  title: 'VibeStream',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props
  const messages = await getMessages()

  return (
    <html lang="pt" className={`${splineSans.variable} ${plusJakartaSans.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
