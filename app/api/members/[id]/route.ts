import { NextRequest } from 'next/server'
import { doc, deleteDoc, updateDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getKSTDateString, maxVacationEnd } from '@/lib/utils'

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
    if (body.clearVacation === true || body.vacationEnd === null) {
      updates.onLeave = false
      const today = getKSTDateString()
      const memberSnap2 = await getDoc(doc(db, 'members', id))
      const data2 = memberSnap2.data() ?? {}
      const existing2: { start: string; end: string }[] = [...(data2.vacations ?? [])]
      updates.vacations = existing2.filter(v => !(today >= v.start && today <= v.end))
      updates.vacationStart = null
      updates.vacationEnd = null
    } else if (body.vacationEnd !== undefined) {
      const today = getKSTDateString()
      const start = body.vacationStart ? String(body.vacationStart) : today
      const end = String(body.vacationEnd)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start))
        return Response.json({ error: '시작일을 확인해주세요' }, { status: 400 })
      if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end <= start)
        return Response.json({ error: '종료일을 확인해주세요' }, { status: 400 })
      const diffDays = (new Date(end + 'T00:00:00Z').getTime() - new Date(start + 'T00:00:00Z').getTime()) / 86400000
      if (diffDays < 2)
        return Response.json({ error: '휴가는 최소 3일 이상이어야 합니다' }, { status: 400 })
      if (diffDays > 13)
        return Response.json({ error: '휴가 기간은 최대 2주입니다' }, { status: 400 })
      // 기존 vacations 배열 읽어서 처리
      const memberSnap = await getDoc(doc(db, 'members', id))
      const data = memberSnap.data() ?? {}
      const existing: { start: string; end: string }[] = [...(data.vacations ?? [])]
      // 구형 데이터 마이그레이션: vacations 배열 없으면 기존 단일 필드로 초기화
      if (existing.length === 0 && data.vacationStart && data.vacationEnd) {
        existing.push({ start: data.vacationStart, end: data.vacationEnd })
      }
      if (data.onLeave) {
        // 현재 휴가 중 → 활성 기간 교체 (날짜 수정)
        const activeIdx = existing.findIndex(v => today >= v.start && today <= v.end)
        if (activeIdx >= 0) {
          existing[activeIdx] = { start, end }
          updates.vacations = existing
        } else {
          updates.vacations = [...existing, { start, end }]
        }
      } else {
        // 휴가 중 아님 → 새 기간 추가
        updates.vacations = [...existing, { start, end }]
      }
      // 과거 휴가(종료일이 오늘 이전)면 onLeave 변경 없이 기록만 추가
      const isCurrentOrFuture = end >= today
      if (isCurrentOrFuture) {
        updates.vacationStart = start
        updates.vacationEnd = end
        updates.onLeave = true
      }
    }
    if (body.onLeave !== undefined) updates.onLeave = Boolean(body.onLeave)
    if (body.finishOnly !== undefined) updates.finishOnly = Boolean(body.finishOnly)
    if (body.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(body.color)) updates.color = body.color
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
