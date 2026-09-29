import { NextRequest } from 'next/server'
import { collection, getDocs, query, where, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { extractKmFromPhoto } from '@/lib/extract-km'

// GET: 처리 현황 조회 (?startDate=2026-09-01&endDate=2026-09-30)
export async function GET(request: NextRequest) {
  try {
    const startDate = request.nextUrl.searchParams.get('startDate')
    const endDate = request.nextUrl.searchParams.get('endDate')
    let q = query(collection(db, 'checkins'), where('photoUrl', '!=', null))
    if (startDate) q = query(collection(db, 'checkins'), where('photoUrl', '!=', null), where('date', '>=', startDate))
    const snap = await getDocs(q)
    const docs = endDate ? snap.docs.filter(d => d.data().date <= endDate) : snap.docs
    const total = docs.length
    const done = docs.filter(d => d.data().km !== undefined).length
    return Response.json({ total, done, remaining: total - done })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// POST: 미처리 체크인 최대 10개 일괄 처리 (body: { startDate?, endDate? })
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { startDate, endDate } = body as { startDate?: string; endDate?: string }
    let q = query(collection(db, 'checkins'), where('photoUrl', '!=', null))
    if (startDate) q = query(collection(db, 'checkins'), where('photoUrl', '!=', null), where('date', '>=', startDate))
    const snap = await getDocs(q)
    const docs = endDate ? snap.docs.filter(d => d.data().date <= endDate) : snap.docs
    const unprocessed = docs.filter(d => d.data().km === undefined).slice(0, 10)

    const results = await Promise.all(
      unprocessed.map(async (d) => {
        const photoUrl = d.data().photoUrl as string
        const km = await extractKmFromPhoto(photoUrl)
        await updateDoc(d.ref, { km: km ?? null })
        return { id: d.id, date: d.data().date, km }
      })
    )

    const remaining = docs.filter(d => d.data().km === undefined).length - unprocessed.length
    return Response.json({ processed: results.length, results, remaining })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
