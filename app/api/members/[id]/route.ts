import { NextRequest } from 'next/server'
import { doc, deleteDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) {
      if (!body.name?.trim()) return Response.json({ error: '이름을 입력해주세요' }, { status: 400 })
      const existing = await getDocs(query(collection(db, 'members'), where('name', '==', body.name.trim())))
      if (!existing.empty && existing.docs[0].id !== id)
        return Response.json({ error: '이미 존재하는 이름입니다' }, { status: 409 })
      updates.name = body.name.trim()
    }
    if (body.onLeave !== undefined) updates.onLeave = Boolean(body.onLeave)
    if (Object.keys(updates).length === 0) return Response.json({ error: '변경할 내용이 없습니다' }, { status: 400 })
    await updateDoc(doc(db, 'members', id), updates)
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteDoc(doc(db, 'members', id))
    const checkinSnap = await getDocs(query(collection(db, 'checkins'), where('memberId', '==', id)))
    await Promise.all(checkinSnap.docs.map(d => deleteDoc(d.ref)))
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
