import { NextRequest } from 'next/server'
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function getDates(startDate: string, days: number): string[] {
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate + 'T00:00:00.000Z')
    d.setUTCDate(d.getUTCDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function tsToISO(ts: unknown): string | null {
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  return null
}

export async function GET(request: NextRequest) {
  try {
    const startDate = request.nextUrl.searchParams.get('startDate') ?? '2025-05-25'
    const days = Math.min(parseInt(request.nextUrl.searchParams.get('days') ?? '7', 10), 31)
    const dates = getDates(startDate, days)

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
