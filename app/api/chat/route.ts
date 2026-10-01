import { NextRequest } from 'next/server'
import { collection, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getKSTDateString } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const { memberId, memberName, memberColor, text } = await request.json()
    if (!memberId || !memberName || !memberColor || !text?.trim()) {
      return Response.json({ error: '필수 항목 누락' }, { status: 400 })
    }
    if (text.trim().length > 200) {
      return Response.json({ error: '200자 이내로 입력해주세요' }, { status: 400 })
    }
    await addDoc(collection(db, 'chats'), {
      memberId,
      memberName,
      memberColor,
      text: text.trim(),
      date: getKSTDateString(),
      createdAt: serverTimestamp(),
    })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[chat POST]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id, memberId } = await request.json()
    if (!id || !memberId) return Response.json({ error: '필수 항목 누락' }, { status: 400 })
    const ref = doc(db, 'chats', id)
    const snap = await getDoc(ref)
    if (!snap.exists() || snap.data().memberId !== memberId) {
      return Response.json({ error: '권한 없음' }, { status: 403 })
    }
    await deleteDoc(ref)
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[chat DELETE]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, memberId, text } = await request.json()
    if (!id || !memberId || !text?.trim()) return Response.json({ error: '필수 항목 누락' }, { status: 400 })
    if (text.trim().length > 200) return Response.json({ error: '200자 이내로 입력해주세요' }, { status: 400 })
    const ref = doc(db, 'chats', id)
    const snap = await getDoc(ref)
    if (!snap.exists() || snap.data().memberId !== memberId) {
      return Response.json({ error: '권한 없음' }, { status: 403 })
    }
    await updateDoc(ref, { text: text.trim() })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[chat PATCH]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
