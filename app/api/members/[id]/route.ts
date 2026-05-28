import { NextRequest } from 'next/server'
import { doc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

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
