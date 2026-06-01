import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SUJIMOM Morning Workout Club',
    short_name: 'SUJIMOM',
    description: '매일 아침 멤버들과 함께 기상 루틴을 심플하게 증명하세요.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0e0f0c',
    icons: [
      {
        src: '/home-img.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
  }
}
