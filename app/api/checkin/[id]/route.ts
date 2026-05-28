import { NextRequest } from 'next/server'
import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function tsToISO(ts: unknown): string | null {
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  return null
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const snap = await getDoc(doc(db, 'checkins', id))
    if (!snap.exists()) return Response.json({ error: 'Not found' }, { status: 404 })
    const c = snap.data()
    return Response.json({
      id: snap.id,
      memberId: c.memberId,
      date: c.date,
      wokeAt: tsToISO(c.wokeAt),
      startedAt: tsToISO(c.startedAt),
      finishedAt: tsToISO(c.finishedAt),
      photoUrl: c.photoUrl ?? null,
      memo: c.memo ?? null,
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
