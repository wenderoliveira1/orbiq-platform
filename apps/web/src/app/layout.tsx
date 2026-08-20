import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Orbiq',
  description: 'Automotive Operations Platform',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
