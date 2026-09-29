import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function extractKmFromPhoto(photoUrl: string): Promise<number | null> {
  try {
    const match = photoUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
    if (!match) return null
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    const data = match[2]

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: '이미지를 모든 방향(회전 포함)으로 살펴서 운동 거리(km) 숫자를 찾아줘. Garmin, Strava, Nike Run 등 앱 오버레이나 워터마크에 "거리", "distance", "km" 옆에 있는 숫자를 찾아. 숫자만 반환해 (예: 5.23). km 정보가 없으면 "null"만 반환해. 다른 말은 하지 마.' },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    if (text === 'null' || text === '') return null
    const num = parseFloat(text.replace(/[^0-9.]/g, ''))
    return isNaN(num) ? null : num
  } catch (err) {
    console.error('[extract-km]', err)
    return null
  }
}
