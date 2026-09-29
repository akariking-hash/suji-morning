import { collection, getDocs, query, where, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { extractKmFromPhoto } from '@/lib/extract-km'

// GET: 처리 현황 조회
export async function GET() {
  try {
    const snap = await getDocs(query(collection(db, 'checkins'), where('photoUrl', '!=', null)))
    const total = snap.docs.length
    const done = snap.docs.filter(d => d.data().km !== undefined).length
    return Response.json({ total, done, remaining: total - done })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// POST: 미처리 체크인 최대 10개 일괄 처리
export async function POST() {
  try {
    const snap = await getDocs(query(collection(db, 'checkins'), where('photoUrl', '!=', null)))
    const unprocessed = snap.docs.filter(d => d.data().km === undefined).slice(0, 10)

    const results = await Promise.all(
      unprocessed.map(async (d) => {
        const photoUrl = d.data().photoUrl as string
        const km = await extractKmFromPhoto(photoUrl)
        await updateDoc(d.ref, { km: km ?? null })
        return { id: d.id, date: d.data().date, km }
      })
    )

    const remaining = snap.docs.filter(d => d.data().km === undefined).length - unprocessed.length
    return Response.json({ processed: results.length, results, remaining })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
