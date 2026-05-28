import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getKSTDateString } from '@/lib/utils'

function getLast7Dates(): string[] {
  const today = getKSTDateString()
  const dates: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today + 'T00:00:00.000Z')
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function tsToISO(ts: unknown): string | null {
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  return null
}

export async function GET() {
  try {
    const dates = getLast7Dates()
    const [membersSnap, checkinsSnap] = await Promise.all([
      getDocs(query(collection(db, 'members'), orderBy('createdAt', 'asc'))),
      getDocs(query(collection(db, 'checkins'), where('date', 'in', dates))),
    ])

    const result = dates.map(date => ({
      date,
      cells: membersSnap.docs.map(m => {
        const ciDoc = checkinsSnap.docs.find(
          d => d.data().memberId === m.id && d.data().date === date
        )
        if (!ciDoc) {
          return {
            memberId: m.id, checkinId: null,
            wokeAt: false, startedAt: false, finishedAt: false,
            photoUrl: null, memo: null,
            wokeTime: null, startedTime: null, finishedTime: null,
          }
        }
        const c = ciDoc.data()
        return {
          memberId: m.id,
          checkinId: ciDoc.id,
          wokeAt: !!c.wokeAt,
          startedAt: !!c.startedAt,
          finishedAt: !!c.finishedAt,
          photoUrl: c.photoUrl ?? null,
          memo: c.memo ?? null,
          wokeTime: tsToISO(c.wokeAt),
          startedTime: tsToISO(c.startedAt),
          finishedTime: tsToISO(c.finishedAt),
        }
      }),
    }))

    return Response.json(result)
  } catch (err) {
    console.error('[matrix GET]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
