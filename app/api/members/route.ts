import { collection, getDocs, addDoc, query, orderBy, where, serverTimestamp, Timestamp, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function toISO(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  return new Date().toISOString()
}

export async function GET() {
  try {
    const snap = await getDocs(query(collection(db, 'members'), orderBy('createdAt', 'asc')))
    const members = snap.docs.map(d => ({
      id: d.id,
      name: d.data().name as string,
      color: d.data().color as string,
      createdAt: toISO(d.data().createdAt),
      onLeave: d.data().onLeave === true,
      finishOnly: d.data().finishOnly === true,
      vacationStart: (d.data().vacationStart as string) ?? null,
      vacationEnd: (d.data().vacationEnd as string) ?? null,
      vacations: (d.data().vacations as { start: string; end: string }[]) ?? undefined,
    }))
    return Response.json(members)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, color } = await request.json()
    if (!name?.trim()) return Response.json({ error: '이름을 입력해주세요' }, { status: 400 })

    const existing = await getDocs(query(collection(db, 'members'), where('name', '==', name.trim())))
    if (!existing.empty) return Response.json({ error: '이미 존재하는 이름입니다' }, { status: 409 })

    const ref = await addDoc(collection(db, 'members'), {
      name: name.trim(),
      color: color || '#9fe870',
      createdAt: serverTimestamp(),
    })

    // 탈퇴 기록 확인
    const deletedSnap = await getDocs(query(collection(db, 'deleted_members'), where('name', '==', name.trim()), limit(1)))
    if (!deletedSnap.empty) {
      const old = deletedSnap.docs[0]
      const oldCheckins = await getDocs(query(collection(db, 'checkins'), where('memberId', '==', old.data().originalId)))
      if (oldCheckins.docs.length > 0) {
        return Response.json({
          id: ref.id, name: name.trim(), color: color || '#9fe870',
          hasOldData: true,
          oldMemberId: old.data().originalId,
          oldCount: oldCheckins.docs.length,
          deletedDocId: old.id,
        }, { status: 201 })
      }
    }

    return Response.json({ id: ref.id, name: name.trim(), color: color || '#9fe870' }, { status: 201 })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
