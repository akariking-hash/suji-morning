import { NextRequest } from 'next/server'
import { collection, getDocs, query, where, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { extractKmFromPhoto } from '@/lib/extract-km'

// GET: 처리 현황 조회 (?startDate=2026-09-01&endDate=2026-09-30)
export async function GET(request: NextRequest) {
  try {
    const startDate = request.nextUrl.searchParams.get('startDate')
    const endDate = request.nextUrl.searchParams.get('endDate')
    const snap = await getDocs(query(collection(db, 'checkins'), where('photoUrl', '!=', null)))
    let docs = snap.docs
    if (startDate) docs = docs.filter(d => d.data().date >= startDate)
    if (endDate) docs = docs.filter(d => d.data().date <= endDate)
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
    const snap = await getDocs(query(collection(db, 'checkins'), where('photoUrl', '!=', null)))
    let docs = snap.docs
    if (startDate) docs = docs.filter(d => d.data().date >= startDate)
    if (endDate) docs = docs.filter(d => d.data().date <= endDate)
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
