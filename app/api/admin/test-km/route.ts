import { NextRequest } from 'next/server'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Anthropic from '@anthropic-ai/sdk'

// GET /api/admin/test-km?checkinId=xxx
export async function GET(request: NextRequest) {
  try {
    const checkinId = request.nextUrl.searchParams.get('checkinId')
    if (!checkinId) return Response.json({ error: 'checkinId 필수' }, { status: 400 })

    const snap = await getDoc(doc(db, 'checkins', checkinId))
    if (!snap.exists()) return Response.json({ error: '체크인 없음' }, { status: 404 })

    const photoUrl = snap.data().photoUrl as string | null
    if (!photoUrl) return Response.json({ error: '사진 없음' }, { status: 400 })

    const match = photoUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
    if (!match) return Response.json({ error: 'photoUrl 형식 오류' }, { status: 400 })

    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    const data = match[2]

    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
        { type: 'text', text: '이 이미지에서 운동 거리(km) 숫자를 찾아줘. 숫자만 반환해 (예: 5.23). km 정보가 없으면 "null"만 반환해. 다른 말은 하지 마.' },
      ]}],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const km = (rawText && rawText !== 'null') ? parseFloat(rawText.replace(/[^0-9.]/g, '')) : null
    const kmValue = (km && !isNaN(km)) ? km : null
    // Firestore에도 저장
    await updateDoc(doc(db, 'checkins', checkinId), { km: kmValue })
    return Response.json({
      checkinId,
      date: snap.data().date,
      apiKeyPresent: !!process.env.ANTHROPIC_API_KEY,
      rawText,
      km: kmValue,
      mediaType,
      dataLength: data.length,
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
