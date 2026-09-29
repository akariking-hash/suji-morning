import { NextRequest } from 'next/server'
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function tsToISO(ts: unknown): string | null {
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  return null
}

// GET /api/checkin/monthly?memberId=xxx&year=2026&month=6
export async function GET(request: NextRequest) {
  try {
    const memberId = request.nextUrl.searchParams.get('memberId')
    const year = parseInt(request.nextUrl.searchParams.get('year') ?? '0', 10)
    const month = parseInt(request.nextUrl.searchParams.get('month') ?? '0', 10)

    if (!memberId || !year || !month)
      return Response.json({ error: 'memberId, year, month 필수' }, { status: 400 })

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const snap = await getDocs(query(
      collection(db, 'checkins'),
      where('memberId', '==', memberId),
    ))

    const result: Record<string, { wokeAt: boolean; startedAt: boolean; finishedAt: boolean; finishedTime: string | null; checkinId: string; wokeTime: string | null; startedTime: string | null; memo: string | null; km: number | null }> = {}
    for (const d of snap.docs) {
      const c = d.data()
      const date = c.date as string
      if (date >= startDate && date <= endDate) {
        result[date] = {
          wokeAt: !!c.wokeAt,
          startedAt: !!c.startedAt,
          finishedAt: !!c.finishedAt,
          finishedTime: tsToISO(c.finishedAt),
          checkinId: d.id,
          wokeTime: tsToISO(c.wokeAt),
          startedTime: tsToISO(c.startedAt),
          memo: c.memo ?? null,
          km: (c.km as number) ?? null,
        }
      }
    }

    return Response.json({ startDate, endDate, daysInMonth, checkins: result })
  } catch (err) {
    console.error('[checkin/monthly GET]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
