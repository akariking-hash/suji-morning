import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SUJIMOM — Morning Workout Club',
  description: '매일 아침 크루들과 함께 기상 루틴을 심플하게 증명하세요.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white">{children}</body>
    </html>
  )
}
