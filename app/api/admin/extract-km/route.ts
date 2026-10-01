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

// POST: km 재처리 (body: { startDate?, endDate?, memberIds?, force? })
// force=true이면 기존 km 값과 상관없이 모든 사진 재처리
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { startDate, endDate, memberIds, force } = body as { startDate?: string; endDate?: string; memberIds?: string[]; force?: boolean }
    const snap = await getDocs(query(collection(db, 'checkins'), where('photoUrl', '!=', null)))
    let docs = snap.docs
    if (startDate) docs = docs.filter(d => d.data().date >= startDate)
    if (endDate) docs = docs.filter(d => d.data().date <= endDate)
    if (memberIds && memberIds.length > 0) docs = docs.filter(d => memberIds.includes(d.data().memberId))
    const toProcess = (force
      ? docs
      : docs.filter(d => {
          const km = d.data().km
          return (km === undefined || km === null) && !d.data().kmChecked
        })
    ).slice(0, 5)

    const results = await Promise.all(
      toProcess.map(async (d) => {
        const photoUrl = d.data().photoUrl as string
        const km = await extractKmFromPhoto(photoUrl)
        // km이 없으면 kmChecked: true로 표시해서 무한 반복 방지
        await updateDoc(d.ref, km != null ? { km } : { km: null, kmChecked: true })
        return { id: d.id, date: d.data().date, km }
      })
    )

    const remaining = (force
      ? docs.length
      : docs.filter(d => {
          const km = d.data().km
          return (km === undefined || km === null) && !d.data().kmChecked
        }).length
    ) - toProcess.length

    return Response.json({ processed: results.length, results, remaining })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
