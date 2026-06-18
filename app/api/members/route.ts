import { collection, getDocs, addDoc, query, orderBy, where, serverTimestamp, Timestamp } from 'firebase/firestore'
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
    return Response.json({ id: ref.id, name: name.trim(), color: color || '#9fe870' }, { status: 201 })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
