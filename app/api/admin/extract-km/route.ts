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
    // km이 양수인 것만 완료로 간주 (null은 미추출 또는 km 없는 사진)
    const done = docs.filter(d => typeof d.data().km === 'number' && d.data().km > 0).length
    const noKm = docs.filter(d => d.data().km === null).length
    const unprocessed = docs.filter(d => d.data().km === undefined).length
    return Response.json({ total, done, noKm, unprocessed })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// POST: km이 null이거나 undefined인 체크인 최대 5개 재처리 (body: { startDate?, endDate? })
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { startDate, endDate } = body as { startDate?: string; endDate?: string }
    const snap = await getDocs(query(collection(db, 'checkins'), where('photoUrl', '!=', null)))
    let docs = snap.docs
    if (startDate) docs = docs.filter(d => d.data().date >= startDate)
    if (endDate) docs = docs.filter(d => d.data().date <= endDate)
    // km이 undefined이거나 null인 것 재처리
    const toProcess = docs.filter(d => {
      const km = d.data().km
      return km === undefined || km === null
    }).slice(0, 5)

    const results = await Promise.all(
      toProcess.map(async (d) => {
        const photoUrl = d.data().photoUrl as string
        const km = await extractKmFromPhoto(photoUrl)
        await updateDoc(d.ref, { km: km ?? null })
        return { id: d.id, date: d.data().date, km }
      })
    )

    const remaining = docs.filter(d => {
      const km = d.data().km
      return km === undefined || km === null
    }).length - toProcess.length

    return Response.json({ processed: results.length, results, remaining })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
