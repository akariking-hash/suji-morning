import { NextRequest } from 'next/server'
import { collection, getDocs, doc, deleteDoc, updateDoc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const { newMemberId, oldMemberId, deletedDocId } = await request.json()
    if (!newMemberId || !oldMemberId) return Response.json({ error: '필수 파라미터 누락' }, { status: 400 })

    const snap = await getDocs(query(collection(db, 'checkins'), where('memberId', '==', oldMemberId)))
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, { memberId: newMemberId })))

    if (deletedDocId) {
      await deleteDoc(doc(db, 'deleted_members', deletedDocId))
    }

    return Response.json({ ok: true, restored: snap.docs.length })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
