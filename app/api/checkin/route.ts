import { NextRequest } from 'next/server'
import { collection, getDocs, addDoc, updateDoc, query, where, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getKSTDateString } from '@/lib/utils'

function tsToISO(ts: unknown): string | null {
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  if (ts instanceof Date) return ts.toISOString()
  return null
}

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date') || getKSTDateString()
    const [membersSnap, checkinsSnap] = await Promise.all([
      getDocs(query(collection(db, 'members'), orderBy('createdAt', 'asc'))),
      getDocs(query(collection(db, 'checkins'), where('date', '==', date))),
    ])
    const checkinMap = new Map(checkinsSnap.docs.map(d => [d.data().memberId as string, { id: d.id, ...d.data() }]))
    const result = membersSnap.docs.map(d => {
      const member = { id: d.id, name: d.data().name as string, color: d.data().color as string, createdAt: '' }
      const ci = checkinMap.get(d.id) as Record<string, unknown> & { id: string } | undefined
      return {
        member,
        checkin: ci ? {
          id: ci.id,
          memberId: ci.memberId as string,
          date: ci.date as string,
          wokeAt: tsToISO(ci.wokeAt),
          startedAt: tsToISO(ci.startedAt),
          finishedAt: tsToISO(ci.finishedAt),
          photoUrl: (ci.photoUrl as string) ?? null,
          memo: (ci.memo as string) ?? null,
        } : null,
      }
    })
    return Response.json(result)
  } catch (err) {
    console.error('[checkin GET]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { memberId, step, photoUrl, memo } = await request.json()
    if (!memberId || !step) return Response.json({ error: 'memberId, step 필수' }, { status: 400 })

    const date = getKSTDateString()
    const now = new Date()
    const updateFields: Record<string, unknown> = {}

    if (step === 'woke') {
      updateFields.wokeAt = now
    } else if (step === 'started') {
      updateFields.startedAt = now
    } else if (step === 'finished') {
      updateFields.finishedAt = now
      updateFields.photoUrl = photoUrl ?? null
      updateFields.memo = memo ?? null
    } else {
      return Response.json({ error: '유효하지 않은 step' }, { status: 400 })
    }

    const existing = await getDocs(query(
      collection(db, 'checkins'),
      where('memberId', '==', memberId),
      where('date', '==', date)
    ))

    if (existing.empty) {
      await addDoc(collection(db, 'checkins'), {
        memberId,
        date,
        wokeAt: null,
        startedAt: null,
        finishedAt: null,
        photoUrl: null,
        memo: null,
        ...updateFields,
        createdAt: serverTimestamp(),
      })
    } else {
      await updateDoc(existing.docs[0].ref, updateFields)
    }
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[checkin POST]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { memberId, date, step } = await request.json()
    const targetDate = date || getKSTDateString()

    const existing = await getDocs(query(
      collection(db, 'checkins'),
      where('memberId', '==', memberId),
      where('date', '==', targetDate)
    ))
    if (existing.empty) return Response.json({ ok: true })

    let clearFields: Record<string, null> = {}
    if (step === 'woke') {
      clearFields = { wokeAt: null, startedAt: null, finishedAt: null, photoUrl: null, memo: null }
    } else if (step === 'started') {
      clearFields = { startedAt: null, finishedAt: null, photoUrl: null, memo: null }
    } else if (step === 'finished') {
      clearFields = { finishedAt: null, photoUrl: null, memo: null }
    } else {
      return Response.json({ error: '유효하지 않은 step' }, { status: 400 })
    }

    await updateDoc(existing.docs[0].ref, clearFields)
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[checkin DELETE]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
