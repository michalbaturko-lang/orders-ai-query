import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RM Database Tool',
  description: 'Nahrávejte data a ptejte se pomocí AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="cs">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
