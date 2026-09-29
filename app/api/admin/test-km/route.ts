import { NextRequest } from 'next/server'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { extractKmFromPhoto } from '@/lib/extract-km'

// GET /api/admin/test-km?checkinId=xxx
export async function GET(request: NextRequest) {
  try {
    const checkinId = request.nextUrl.searchParams.get('checkinId')
    if (!checkinId) return Response.json({ error: 'checkinId 필수' }, { status: 400 })

    const snap = await getDoc(doc(db, 'checkins', checkinId))
    if (!snap.exists()) return Response.json({ error: '체크인 없음' }, { status: 404 })

    const photoUrl = snap.data().photoUrl as string | null
    if (!photoUrl) return Response.json({ error: '사진 없음' }, { status: 400 })

    const km = await extractKmFromPhoto(photoUrl)
    return Response.json({ checkinId, date: snap.data().date, km, apiKeyPresent: !!process.env.ANTHROPIC_API_KEY })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
