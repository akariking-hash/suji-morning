import { NextRequest } from 'next/server'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
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
