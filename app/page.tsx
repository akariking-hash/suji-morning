'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────
type Member = { id: string; name: string; color: string; createdAt: string; onLeave?: boolean }
type CheckIn = {
  id: string
  memberId: string
  date: string
  wokeAt: string | null
  startedAt: string | null
  finishedAt: string | null
  photoUrl: string | null
  memo: string | null
}
type BoardEntry = { member: Member; checkin: CheckIn | null }
type MatrixCell = {
  memberId: string
  checkinId: string | null
  wokeAt: boolean
  startedAt: boolean
  finishedAt: boolean
  memo: string | null
  wokeTime: string | null
  startedTime: string | null
  finishedTime: string | null
}
type MatrixDay = { date: string; cells: MatrixCell[] }
type DetailData = { member: Member; date: string; checkin: CheckIn }

// ─── Constants ────────────────────────────────────────────────────────
const COLOR_PALETTE = [
  { hex: '#9fe870', name: 'LIME' },
  { hex: '#ff6b6b', name: 'CORAL' },
  { hex: '#ffd93d', name: 'GOLD' },
  { hex: '#6bcfff', name: 'SKY' },
  { hex: '#a78bfa', name: 'VIOLET' },
  { hex: '#fb923c', name: 'ORANGE' },
  { hex: '#34d399', name: 'EMERALD' },
  { hex: '#f472b6', name: 'PINK' },
  { hex: '#60a5fa', name: 'BLUE' },
  { hex: '#facc15', name: 'AMBER' },
  { hex: '#c084fc', name: 'PURPLE' },
  { hex: '#2dd4bf', name: 'TEAL' },
]

const WORKOUT_PRESETS = [
  { id: 'run', emoji: '🏃', label: '달리기', bg: '#dcfce7' },
  { id: 'gym', emoji: '💪', label: '헬스장', bg: '#fff7ed' },
  { id: 'yoga', emoji: '🧘', label: '요가', bg: '#faf5ff' },
  { id: 'swim', emoji: '🏊', label: '수영', bg: '#eff6ff' },
  { id: 'hiking', emoji: '⛰️', label: '등산', bg: '#f0fdf4' },
]

// ─── Helpers ──────────────────────────────────────────────────────────
function getKSTDateString(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

function formatKSTTime(isoStr: string | null): string {
  if (!isoStr) return '--:--'
  const d = new Date(isoStr)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const h = kst.getUTCHours().toString().padStart(2, '0')
  const m = kst.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function getInitials(name: string): string {
  return (name[3] ?? name[0] ?? '?').toUpperCase()
}

const MIN_WEEK_MONDAY = '2025-05-25'

function getWeekMonday(weekOffset: number): string {
  const today = new Date(getKSTDateString() + 'T00:00:00.000Z')
  const dow = today.getUTCDay()
  const daysBack = dow === 0 ? 6 : dow - 1
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() - daysBack + weekOffset * 7)
  return monday.toISOString().split('T')[0]
}

function getWeekDays(weekOffset: number): { date: string; label: string; weekday: string }[] {
  const monday = getWeekMonday(weekOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday + 'T00:00:00.000Z')
    d.setUTCDate(d.getUTCDate() + i)
    const date = d.toISOString().split('T')[0]
    const dateObj = new Date(date + 'T12:00:00+09:00')
    const label = dateObj.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
    const weekday = dateObj.toLocaleDateString('ko-KR', { weekday: 'short' })
    return { date, label, weekday }
  })
}

function makePresetDataUrl(emoji: string, bg: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280">
    <rect width="400" height="280" fill="${bg}" rx="16"/>
    <text x="200" y="120" font-size="100" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    <text x="200" y="220" font-family="Pretendard,-apple-system,sans-serif" font-size="36" font-weight="800" fill="#163300" text-anchor="middle">${label}</text>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

// ─── Image Compression ────────────────────────────────────────────────
// Storage 업로드 없이 Firestore에 직접 저장할 data URL로 변환
function compressToDataUrl(file: File, maxPx = 640, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round((height / width) * maxPx); width = maxPx }
        else { width = Math.round((width / height) * maxPx); height = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')) }
    img.src = url
  })
}

// ─── Design Tokens ────────────────────────────────────────────────────
const T = {
  // typography
  hero: 'text-[96px] font-[900] leading-[0.9] tracking-tighter',
  sectionTitle: 'text-[48px] font-[800] leading-[0.95] tracking-tight',
  cardTitle: 'text-[28px] font-[700] leading-[1.2]',
  body: 'text-[18px] font-[500] leading-[1.5]',
  small: 'text-[14px] font-[500] leading-[1.4]',
  caps: 'text-[12px] font-[500] uppercase tracking-widest',
  // buttons
  btnPrimary: 'rounded-full font-[700] text-[16px] cursor-pointer transition-all active:scale-95',
  btnDark: 'rounded-full font-[700] text-[16px] bg-[#0e0f0c] hover:bg-neutral-800 text-white cursor-pointer transition-all active:scale-95',
  btnGhost: 'rounded-full font-[700] text-[16px] border border-[rgba(14,15,12,0.15)] hover:bg-[#e8ebe6] text-[#0e0f0c] cursor-pointer transition-all',
  btnH: 'h-[52px] px-6',
  btnHFull: 'w-full h-[52px]',
}

// ─── Sub Components ───────────────────────────────────────────────────
function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-[36px] border border-[rgba(14,15,12,0.12)] flex flex-col max-h-[90vh] overflow-hidden"
        style={{ boxShadow: '0 0 0 1px rgba(14,15,12,0.12), 0 32px 64px -16px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 rounded-full hover:bg-[#e8ebe6] transition-colors cursor-pointer text-[#868685]"
    >
      <XIcon size={20} />
    </button>
  )
}

function StepCard({
  step, title, label, desc, done, doneColor, actionArea,
}: {
  step: number; title: string; label: string; desc: string
  done: boolean; doneColor?: string; actionArea: React.ReactNode
}) {
  return (
    <div
      className="wise-card p-8 flex flex-col justify-between h-full transition-all duration-300"
      style={done ? { borderColor: doneColor ?? '#9fe870', borderWidth: '2px' } : undefined}
    >
      <div className="flex flex-col gap-3">
        {/* Label + Title one line */}
        <div className="flex items-center gap-3">
          <span className="text-[20px] font-[500] uppercase tracking-widest text-[#868685]">{label}</span>
          <h4 className={`${T.cardTitle} text-[#0e0f0c] whitespace-nowrap`}>{title}</h4>
        </div>
        <p className={`${T.small} text-[#868685]`}>{desc}</p>
      </div>

      <div className="mt-6">{actionArea}</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────
export default function SujiMomPage() {
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [board, setBoard] = useState<BoardEntry[]>([])
  const [matrix, setMatrix] = useState<MatrixDay[]>([])
  const [kstClock, setKstClock] = useState('--:--:--')

  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showMemberSelectModal, setShowMemberSelectModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailData, setDetailData] = useState<DetailData | null>(null)
  const [detailPhotoUrl, setDetailPhotoUrl] = useState<string | null>(null)
  const [detailPhotoLoading, setDetailPhotoLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; desc: string; okLabel?: string; onOk: () => void } | null>(null)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberColor, setNewMemberColor] = useState('#9fe870')
  const [memberFormError, setMemberFormError] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editingMemberName, setEditingMemberName] = useState('')
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)

  const [photoMode, setPhotoMode] = useState<'gallery' | 'camera' | 'file' | 'preset'>('gallery')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoIsPreset, setPhotoIsPreset] = useState(false)
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showMonthlyModal, setShowMonthlyModal] = useState(false)
  const [monthlyMember, setMonthlyMember] = useState<Member | null>(null)
  const [monthlyData, setMonthlyData] = useState<MatrixDay[]>([])
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [monthlyOffset, setMonthlyOffset] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const matrixScrollRef = useRef<HTMLDivElement>(null)
  const todayColRef = useRef<HTMLTableCellElement>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState('')

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null
  const selectedEntry = board.find((b) => b.member.id === selectedMemberId) ?? null
  const checkin = selectedEntry?.checkin ?? null

  // ─── Clock ────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
      const h = kst.getUTCHours()
      const ampm = h < 12 ? 'AM' : 'PM'
      const m = kst.getUTCMinutes().toString().padStart(2, '0')
      const s = kst.getUTCSeconds().toString().padStart(2, '0')
      setKstClock(`${ampm} ${h.toString().padStart(2, '0')}:${m}:${s}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('sujimom_member')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed?.id) setSelectedMemberId(String(parsed.id))
      } catch {
        localStorage.removeItem('sujimom_member')
      }
    }
  }, [])

  useEffect(() => {
    if (members.length > 0 && selectedMemberId !== null) {
      if (!members.find((m) => m.id === selectedMemberId)) {
        setSelectedMemberId(null)
        localStorage.removeItem('sujimom_member')
      }
    }
  }, [members, selectedMemberId])

  const fetchData = useCallback(async (offset = 0) => {
    try {
      const today = getKSTDateString()
      const monday = getWeekMonday(offset)
      const [boardRes, matrixRes, membersRes] = await Promise.all([
        fetch(`/api/checkin?date=${today}`),
        fetch(`/api/matrix?startDate=${monday}`),
        fetch('/api/members'),
      ])
      if (boardRes.ok) setBoard(await boardRes.json())
      if (matrixRes.ok) setMatrix(await matrixRes.json())
      if (membersRes.ok) {
        const data: Member[] = await membersRes.json()
        setMembers(data.sort((a, b) => a.name.localeCompare(b.name, 'ko')))
      }
    } catch (e) {
      console.error('fetchData error', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData(weekOffset)
  }, [fetchData, weekOffset])

  useEffect(() => {
    if (!loading) {
      requestAnimationFrame(() => {
        if (!todayColRef.current || !matrixScrollRef.current) return
        const container = matrixScrollRef.current
        const todayTh = todayColRef.current
        const containerRect = container.getBoundingClientRect()
        const todayRect = todayTh.getBoundingClientRect()
        container.scrollLeft += todayRect.left - containerRect.left - Math.round(container.clientWidth * 0.45)
      })
    }
  }, [loading])

  const showAlert = (msg: string) => { setAlertMessage(msg); setShowAlertModal(true) }
  const showConfirm = (title: string, desc: string, onOk: () => void, okLabel?: string) => {
    setConfirmConfig({ title, desc, onOk, okLabel })
    setShowConfirmModal(true)
  }
  const selectMember = (m: Member) => {
    setSelectedMemberId(m.id)
    localStorage.setItem('sujimom_member', JSON.stringify({ id: m.id }))
  }

  // ─── Check-in Actions ─────────────────────────────────────────────
  const handleWoke = async () => {
    if (!selectedMemberId) return
    const res = await fetch('/api/checkin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: selectedMemberId, step: 'woke' }),
    })
    if (res.ok) fetchData()
    else showAlert('기상 인증 등록에 실패했습니다. 다시 시도해 주세요.')
  }

  const handleStarted = async () => {
    if (!selectedMemberId) return
    const res = await fetch('/api/checkin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: selectedMemberId, step: 'started' }),
    })
    if (res.ok) fetchData()
    else showAlert('운동 시작 등록에 실패했습니다. 다시 시도해 주세요.')
  }

  const handleCompleted = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMemberId) return
    setSubmitting(true)
    try {
      let photoUrl: string | null = null
      if (photoFile) {
        photoUrl = await compressToDataUrl(photoFile)
      } else if (photoPreview && photoIsPreset) {
        photoUrl = photoPreview
      }
      const res = await fetch('/api/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selectedMemberId, step: 'finished', photoUrl, memo: memo.trim() || null }),
      })
      if (res.ok) {
        fetchData()
        closeCompleteModal()
        showAlert('오늘 아침 운동 인증이 완료되었습니다!\n멤버들과 함께 해줘서 고마워요!')
      } else {
        showAlert('인증 등록에 실패했습니다. 다시 시도해 주세요.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetStep = (step: 'woke' | 'started' | 'finished') => {
    if (!selectedMemberId) return
    const labels = { woke: '기상', started: '운동 시작', finished: '완료' }
    showConfirm(
      `${labels[step]} 인증 초기화`,
      `${labels[step]} 인증을 취소하면 이후 단계도 함께 지워집니다. 계속하시겠습니까?`,
      async () => {
        const res = await fetch('/api/checkin', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: selectedMemberId, date: getKSTDateString(), step }),
        })
        if (res.ok) fetchData()
        else showAlert('초기화에 실패했습니다. 다시 시도해 주세요.')
      },
      '초기화'
    )
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setMemberFormError('')
    const name = newMemberName.trim()
    if (!name) { setMemberFormError('이름을 입력해주세요'); return }
    setAddingMember(true)
    try {
      const res = await fetch('/api/members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newMemberColor }),
      })
      if (res.ok) {
        setNewMemberName('')
        setNewMemberColor('#9fe870')
        fetchData()
      } else {
        const data = await res.json()
        setMemberFormError(data.error || '등록에 실패했습니다')
      }
    } catch {
      setMemberFormError('서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setAddingMember(false)
    }
  }

  const fetchMonthlyData = async (member: Member, offset: number) => {
    setMonthlyLoading(true)
    const now = new Date(getKSTDateString() + 'T00:00:00.000Z')
    const y = now.getUTCFullYear()
    const mo = now.getUTCMonth() + 1 + offset
    const targetDate = new Date(Date.UTC(y, mo - 1, 1))
    const year = targetDate.getUTCFullYear()
    const month = targetDate.getUTCMonth() + 1
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    try {
      const res = await fetch(`/api/matrix?startDate=${startDate}&days=${daysInMonth}`)
      if (res.ok) setMonthlyData(await res.json())
    } finally {
      setMonthlyLoading(false)
    }
  }

  const openMonthlyModal = (m: Member) => {
    setMonthlyMember(m)
    setMonthlyOffset(0)
    setMonthlyData([])
    setShowMonthlyModal(true)
    fetchMonthlyData(m, 0)
  }

  const handleToggleLeave = async (m: Member) => {
    const res = await fetch(`/api/members/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onLeave: !m.onLeave }),
    })
    if (res.ok) fetchData()
    else showAlert('변경에 실패했습니다.')
  }

  const handleRenameMember = async (id: string) => {
    const name = editingMemberName.trim()
    if (!name) return
    const res = await fetch(`/api/members/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) { setEditingMemberId(null); fetchData() }
    else { const d = await res.json(); showAlert(d.error || '수정에 실패했습니다.') }
  }

  const handleDeleteMember = (id: string, name: string) => {
    showConfirm(
      `${name} 멤버 삭제`,
      '이 멤버의 모든 체크인 기록이 함께 삭제됩니다. 계속하시겠습니까?',
      async () => {
        const res = await fetch(`/api/members/${id}`, { method: 'DELETE' })
        if (res.ok) {
          if (selectedMemberId === id) {
            setSelectedMemberId(null)
            localStorage.removeItem('sujimom_member')
          }
          fetchData()
        } else showAlert('삭제에 실패했습니다. 다시 시도해 주세요.')
      }
    )
  }

  // ─── Camera ───────────────────────────────────────────────────────
  const startCamera = async () => {
    setCameraError('')
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      setCameraStream(stream)
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류'
      setCameraError(`카메라 접근 실패: ${msg}. 파일 업로드나 기본 그래픽을 사용해 주세요.`)
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
        setPhotoFile(file)
        setPhotoIsPreset(false)
        setPhotoPreview(canvas.toDataURL('image/jpeg', 0.9))
      },
      'image/jpeg', 0.9
    )
    const flashEl = document.getElementById('cam-flash')
    if (flashEl) {
      flashEl.style.opacity = '1'
      setTimeout(() => { flashEl.style.opacity = '0' }, 120)
    }
  }

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(null)
    }
  }, [cameraStream])

  const closeCompleteModal = useCallback(() => {
    setShowCompleteModal(false)
    setPhotoPreview(null)
    setPhotoFile(null)
    setPhotoIsPreset(false)
    setMemo('')
    setPhotoMode('gallery')
  }, [])

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { showAlert('이미지 파일만 업로드 가능합니다.'); return }
    if (file.size > 5 * 1024 * 1024) { showAlert('파일 크기는 5MB 이하여야 합니다.'); return }
    setPhotoFile(file)
    setPhotoIsPreset(false)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const todayLabel = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  }).toUpperCase()

  const last7Days = getWeekDays(weekOffset)
  const currentMonday = getWeekMonday(weekOffset)
  const currentSunday = last7Days[6].date
  const canGoPrev = currentMonday > MIN_WEEK_MONDAY
  const canGoNext = true
  const todayStr = getKSTDateString()
  const activeMembers = members.filter(m => !m.onLeave)
  const leaveMembers = members.filter(m => m.onLeave)
  const completedToday = board.filter(b => !!b.checkin?.finishedAt && !b.member.onLeave).length
  const inProgressToday = board.filter(b => !!b.checkin?.startedAt && !b.checkin?.finishedAt && !b.member.onLeave).length

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-[#0e0f0c] antialiased select-none" style={{ fontFamily: "'Pretendard', 'Inter', sans-serif" }}>

      {/* ── NAVBAR ───────────────────────────────────────────────── */}
      <nav className="px-4 md:px-8 py-4 flex justify-between items-center border-b border-[rgba(14,15,12,0.12)] sticky top-0 bg-white/90 backdrop-blur-md z-40">
        <a href="/" className="text-[28px] font-[900] tracking-tight cursor-pointer hover:opacity-70 transition-opacity" style={{ fontFamily: "'Pretendard', sans-serif" }}>
          SUJIMOM
        </a>
        <div className="flex items-center gap-3 md:gap-5">
          <span className={`${T.small} text-[#868685] hidden sm:inline`}>{todayLabel}</span>
          <button
            onClick={() => setShowMembersModal(true)}
            className="relative w-10 h-10 flex items-center justify-center rounded-full border border-[rgba(14,15,12,0.12)] bg-[#e8ebe6] hover:bg-[#d8dbd6] transition-colors cursor-pointer flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {members.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#0e0f0c] text-white text-[10px] font-[700] flex items-center justify-center leading-none">
                {members.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowMemberSelectModal(true)}
            className="flex items-center gap-2 pl-1 pr-4 py-1 rounded-full border transition-all cursor-pointer"
            style={{
              backgroundColor: selectedMember?.color ?? '#e8ebe6',
              borderColor: selectedMember?.color ?? 'rgba(14,15,12,0.12)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-[700] flex-shrink-0"
              style={{ backgroundColor: 'rgba(0,0,0,0.15)', color: '#163300' }}
            >
              {selectedMember ? getInitials(selectedMember.name) : '?'}
            </div>
            <span className="text-[14px] font-[700] whitespace-nowrap" style={{ color: '#163300' }}>
              {selectedMember ? selectedMember.name : '미선택'}
            </span>
          </button>
        </div>
      </nav>

      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 border-b border-[rgba(14,15,12,0.12)] pb-8">
          <div>
            <h1 className="text-[56px] sm:text-[72px] md:text-[96px] font-[900] leading-[0.9] tracking-tight text-[#0e0f0c] uppercase">
              IT&apos;S TIME<br />TO MOVE.
            </h1>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto md:min-w-[200px]">
            <span className={`${T.caps} text-[#868685]`}>KOREA STANDARD TIME</span>
            <div
              className="w-full md:w-auto font-[700] font-mono tracking-tight leading-none px-6 py-4 rounded-[24px] border border-[rgba(14,15,12,0.08)] bg-[#e8ebe6]/40 text-[#0e0f0c] text-center"
              style={{ fontSize: '40px' }}
            >
              {kstClock}
            </div>
          </div>
        </section>

        {/* ── Loading ──────────────────────────────────────────── */}
        {loading && (
          <div className="py-24 text-center flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-t-transparent border-[#0e0f0c] rounded-full animate-spin" />
            <p className={`${T.body} text-[#868685] mt-5`}>데이터를 불러오는 중입니다...</p>
          </div>
        )}

        {!loading && (
          <div className="flex flex-col gap-4">

            {/* ── Member Selector ────────────────────────────── */}
            <section>
              <div className="mb-4">
                <span className={`${T.caps} text-[#868685]`}>SELECT CREW MEMBER</span>
                <h2 className={`${T.cardTitle} text-[#0e0f0c] mt-2`}>인증할 멤버를 선택해 주세요</h2>
              </div>

              {members.length === 0 ? (
                <p className={`${T.small} text-[#868685]`}>멤버가 없습니다. 상단 MEMBERS 버튼에서 멤버를 추가해 주세요.</p>
              ) : (
                <div className="relative w-full md:max-w-xs">
                  <button
                    onClick={() => setShowMemberDropdown(v => !v)}
                    className="w-full h-[52px] px-5 flex items-center gap-3 rounded-[16px] bg-[#e8ebe6]/40 border border-[rgba(14,15,12,0.12)] hover:border-[#9fe870] transition-colors cursor-pointer"
                  >
                    {selectedMember ? (
                      <>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedMember.color }} />
                        <span className="text-[15px] font-[700] text-[#0e0f0c] flex-1 text-left">{selectedMember.name}</span>
                      </>
                    ) : (
                      <span className="text-[15px] text-[#868685] flex-1 text-left">멤버를 선택해 주세요</span>
                    )}
                    <svg
                      xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="#868685" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className={`transition-transform flex-shrink-0 ${showMemberDropdown ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showMemberDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowMemberDropdown(false)} />
                      <div
                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[20px] border border-[rgba(14,15,12,0.10)] z-20 overflow-hidden"
                        style={{ boxShadow: '0 8px 32px -8px rgba(0,0,0,0.15)' }}
                      >
                        {members.map((m) => {
                          const isSelected = selectedMemberId === m.id
                          return (
                            <button
                              key={m.id}
                              onClick={() => { selectMember(m); setShowMemberDropdown(false) }}
                              className="w-full px-5 py-3.5 flex items-center gap-3 transition-colors cursor-pointer hover:bg-[#e8ebe6]/40"
                              style={{ backgroundColor: isSelected ? `${m.color}22` : undefined }}
                            >
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                              <span className="text-[15px] font-[700] text-[#0e0f0c] flex-1 text-left">{m.name}</span>
                              {isSelected && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* ── Check-In Section ──────────────────────────── */}
            <section>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                {/* Step 1 */}
                <StepCard
                  step={1} title="기상 인증" label="STEP 01"
                  desc="아침 눈을 뜨자마자 잠에서 깬 기상 시각을 즉각 기록합니다."
                  done={!!checkin?.wokeAt} doneColor={selectedMember?.color}
                  actionArea={
                    !selectedMember ? (
                      <p className={`${T.small} text-[#868685]`}>↑ 위에서 멤버를 먼저 선택해 주세요</p>
                    ) : checkin?.wokeAt ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`${T.caps} text-[#868685]`}>기상 시각</div>
                          <div className="text-[32px] font-[700] font-mono mt-1">{formatKSTTime(checkin.wokeAt)}</div>
                        </div>
                        <button
                          onClick={() => handleResetStep('woke')}
                          className={`${T.small} font-[700] text-[#868685] hover:text-rose-500 transition-colors px-4 py-2 rounded-full border border-[rgba(14,15,12,0.12)] cursor-pointer`}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleWoke}
                        className={`${T.btnPrimary} ${T.btnHFull} text-[#163300] hover:opacity-90`}
                        style={{ backgroundColor: selectedMember.color }}
                      >
                        기상 인증하기 🌅
                      </button>
                    )
                  }
                />

                {/* Step 2 */}
                <StepCard
                  step={2} title="운동 시작" label="STEP 02"
                  desc="운동 장소에 도착해 첫 운동을 개시하는 순간 시작을 남깁니다."
                  done={!!checkin?.startedAt} doneColor={selectedMember?.color}
                  actionArea={
                    !selectedMember ? (
                      <p className={`${T.small} text-[#868685]`}>↑ 위에서 멤버를 먼저 선택해 주세요</p>
                    ) : checkin?.startedAt ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`${T.caps} text-[#868685]`}>운동 시작</div>
                          <div className="text-[32px] font-[700] font-mono mt-1">{formatKSTTime(checkin.startedAt)}</div>
                        </div>
                        <button
                          onClick={() => handleResetStep('started')}
                          className={`${T.small} font-[700] text-[#868685] hover:text-rose-500 transition-colors px-4 py-2 rounded-full border border-[rgba(14,15,12,0.12)] cursor-pointer`}
                        >
                          취소
                        </button>
                      </div>
                    ) : checkin?.wokeAt ? (
                      <button
                        onClick={handleStarted}
                        className={`${T.btnPrimary} ${T.btnHFull} text-white bg-[#fb923c] hover:bg-[#ea580c]`}
                      >
                        운동 시작 🏃
                      </button>
                    ) : (
                      <div className="h-[52px] rounded-full bg-[#e8ebe6] flex items-center justify-center">
                        <span className={`${T.small} text-[#868685]`}>기상 인증 후 활성화됩니다</span>
                      </div>
                    )
                  }
                />

                {/* Step 3 */}
                <StepCard
                  step={3} title="운동 완료 인증" label="STEP 03"
                  desc="오늘 아침 세션을 완수했음을 사진 한 장과 일기로 최종 서명합니다."
                  done={!!checkin?.finishedAt} doneColor={selectedMember?.color}
                  actionArea={
                    !selectedMember ? (
                      <p className={`${T.small} text-[#868685]`}>↑ 위에서 멤버를 먼저 선택해 주세요</p>
                    ) : checkin?.finishedAt ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className={`${T.caps} text-[#868685]`}>완료 시각</div>
                            <div className="text-[32px] font-[700] font-mono mt-1">{formatKSTTime(checkin.finishedAt)}</div>
                          </div>
                          <button
                            onClick={() => handleResetStep('finished')}
                            className={`${T.small} font-[700] text-[#868685] hover:text-rose-500 transition-colors px-4 py-2 rounded-full border border-[rgba(14,15,12,0.12)] cursor-pointer`}
                          >
                            취소
                          </button>
                        </div>
                        {checkin.photoUrl && (
                          <div className="w-full rounded-[16px] overflow-hidden bg-neutral-100">
                            <img
                              src={checkin.photoUrl} alt="인증 사진" className="w-full h-auto block"
                              onLoad={(e) => {
                                const img = e.currentTarget
                                const container = img.parentElement
                                if (container && img.naturalHeight > img.naturalWidth) {
                                  container.style.aspectRatio = '1'
                                  container.style.display = 'flex'
                                  container.style.alignItems = 'center'
                                }
                              }}
                            />
                          </div>
                        )}
                        {checkin.memo && (
                          <p className={`${T.small} text-[#868685] italic`}>{`"${checkin.memo}"`}</p>
                        )}
                      </div>
                    ) : checkin?.startedAt ? (
                      <button
                        onClick={() => setShowCompleteModal(true)}
                        className={`${T.btnDark} ${T.btnHFull}`}
                      >
                        완료 인증하기 🏆
                      </button>
                    ) : (
                      <div className="h-[52px] rounded-full bg-[#e8ebe6] flex items-center justify-center">
                        <span className={`${T.small} text-[#868685]`}>운동 시작 후 활성화됩니다</span>
                      </div>
                    )
                  }
                />
              </div>
            </section>

            {/* ── Matrix Section ────────────────────────────── */}
            <section className="border-t border-[rgba(14,15,12,0.12)] pt-6 mt-4">
              <div className="mb-4 flex flex-col md:flex-row md:items-end gap-4">
                {/* 타이틀 + 모바일 새로고침 */}
                <div className="md:flex-1 flex items-end justify-between">
                  <div>
                    <span className={`${T.caps} text-[#868685]`}>CREW STATUS MATRIX</span>
                    <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-[800] leading-[0.95] tracking-tight text-[#0e0f0c] mt-2 md:mb-3 whitespace-nowrap">주간 운동 출석판</h2>
                  </div>
                  <button
                    onClick={() => { setRefreshing(true); fetchData(weekOffset) }}
                    disabled={refreshing}
                    className="md:hidden h-10 px-4 rounded-[12px] border border-[rgba(14,15,12,0.12)] flex items-center gap-2 transition-colors cursor-pointer hover:bg-[#e8ebe6] disabled:opacity-50 text-[13px] font-[700] text-[#0e0f0c]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'animate-spin' : ''}>
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                      <path d="M8 16H3v5" />
                    </svg>
                    새로고침
                  </button>
                </div>
                {/* 네비게이션 */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-center md:flex-1 md:mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { if (canGoPrev) setWeekOffset(o => o - 1) }}
                      disabled={!canGoPrev}
                      className="w-10 h-10 rounded-full border border-[rgba(14,15,12,0.12)] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8ebe6]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <div className="text-center min-w-[160px]">
                      <div className="h-[18px] flex items-center justify-center">
                        {weekOffset !== 0 ? (
                          <button
                            onClick={() => setWeekOffset(0)}
                            className={`${T.caps} text-[#9fe870] hover:text-[#163300] transition-colors cursor-pointer border border-[#9fe870] rounded-[8px] px-2 py-0.5`}
                          >
                            이번주로 이동
                          </button>
                        ) : (
                          <span className={`${T.caps} text-[#868685]`}>THIS WEEK</span>
                        )}
                      </div>
                      <div className="text-[14px] font-[700] text-[#0e0f0c] mt-2 whitespace-nowrap">
                        {new Date(currentMonday + 'T12:00:00+09:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                        {' — '}
                        {new Date(currentSunday + 'T12:00:00+09:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                    <button
                      onClick={() => { if (canGoNext) setWeekOffset(o => o + 1) }}
                      disabled={!canGoNext}
                      className="w-10 h-10 rounded-full border border-[rgba(14,15,12,0.12)] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8ebe6]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                </div>
                {/* PC 새로고침 */}
                <div className="hidden md:flex md:flex-1 md:justify-end md:items-end md:mb-3">
                  <button
                    onClick={() => { setRefreshing(true); fetchData(weekOffset) }}
                    disabled={refreshing}
                    className="h-10 px-4 rounded-[12px] border border-[rgba(14,15,12,0.12)] flex items-center gap-2 transition-colors cursor-pointer hover:bg-[#e8ebe6] disabled:opacity-50 text-[13px] font-[700] text-[#0e0f0c]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className={refreshing ? 'animate-spin' : ''}
                    >
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                      <path d="M8 16H3v5" />
                    </svg>
                    새로고침
                  </button>
                </div>
              </div>

              <div className="border border-[rgba(14,15,12,0.12)] rounded-[30px] overflow-hidden bg-white" style={{ boxShadow: '0 0 0 1px rgba(14,15,12,0.04)' }}>
                <div className="overflow-x-auto no-scrollbar" ref={matrixScrollRef}>
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-[#e8ebe6]/30 border-b border-[rgba(14,15,12,0.08)]">
                        <th className="px-4 py-4 w-36 sticky left-0 z-10 bg-[#f5f5f3]" style={{ boxShadow: '1px 0 0 rgba(14,15,12,0.08)' }}>
                          <div className="flex flex-col gap-2 items-center text-center">
                            <p className="text-[12px] font-[500] text-[#868685] leading-snug">
                              지금 <span className="text-[16px] font-[800] text-[#0e0f0c]">{completedToday}</span>명이 완료하고
                            </p>
                            <p className="text-[12px] font-[500] text-[#868685] leading-snug">
                              <span className="text-[16px] font-[800] text-[#0e0f0c]">{inProgressToday}</span>명이 운동중이예요!
                            </p>
                          </div>
                        </th>
                        {last7Days.map(({ date, label, weekday }) => (
                          <th key={date} ref={date === todayStr ? todayColRef : undefined} className="px-4 pt-3 pb-4 text-center">
                            <div className="text-[11px] font-[700] text-[#9fe870] uppercase tracking-wider mb-0.5" style={{ visibility: date === todayStr ? 'visible' : 'hidden' }}>TODAY</div>
                            <div className={`text-[13px] font-[700] whitespace-nowrap ${date === todayStr ? 'text-[#0e0f0c]' : 'text-[#868685]'}`}>
                              {weekday}
                            </div>
                            <div className={`text-[11px] font-[500] mt-0.5 whitespace-nowrap ${date === todayStr ? 'text-[#0e0f0c]' : 'text-[#868685]'}`}>
                              {label}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeMembers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className={`px-6 py-12 text-center ${T.body} text-[#868685]`}>
                            멤버를 추가하면 출석판이 표시됩니다.
                          </td>
                        </tr>
                      ) : activeMembers.map((m, idx) => (
                        <tr
                          key={m.id}
                          className={`border-b border-[rgba(14,15,12,0.06)] last:border-0 ${idx % 2 !== 0 ? 'bg-[#e8ebe6]/10' : ''}`}
                        >
                          <td className={`px-4 py-4 sticky left-0 z-10 ${idx % 2 !== 0 ? 'bg-[#f7f7f5]' : 'bg-white'}`} style={{ boxShadow: '1px 0 0 rgba(14,15,12,0.08)' }}>
                            <div className="flex items-center gap-2.5">
                              <button
                                onClick={() => openMonthlyModal(m)}
                                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform cursor-pointer"
                                style={{ backgroundColor: `${m.color}25`, border: `1.5px solid ${m.color}` }}
                                title="월간 출석표 보기"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                  <line x1="16" y1="2" x2="16" y2="6"/>
                                  <line x1="8" y1="2" x2="8" y2="6"/>
                                  <line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                              </button>
                              <span className="text-[15px] font-[700] text-[#0e0f0c] whitespace-nowrap">{m.name}</span>
                            </div>
                          </td>
                          {last7Days.map(({ date }) => {
                            const day = matrix.find((d) => d.date === date)
                            const cell = day?.cells.find((c) => c.memberId === m.id)
                            const stepCount = cell ? [cell.wokeAt, cell.startedAt, cell.finishedAt].filter(Boolean).length : 0
                            return (
                              <td key={date} className="px-4 py-3 text-center">
                                <div className="h-9 flex items-center justify-center">
                                  {stepCount === 0 ? (
                                    <span className="text-[#868685] text-[18px] font-[300]">—</span>
                                  ) : stepCount === 3 ? (
                                    <button
                                      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-[14px] font-[700] cursor-pointer hover:scale-110 transition-transform"
                                      style={{ backgroundColor: m.color, color: '#163300' }}
                                      title="완료! 클릭하여 증명서 보기"
                                      onClick={() => {
                                        if (!cell?.checkinId) return
                                        setDetailData({
                                          member: m, date,
                                          checkin: {
                                            id: cell.checkinId, memberId: m.id, date,
                                            wokeAt: cell.wokeTime, startedAt: cell.startedTime,
                                            finishedAt: cell.finishedTime, photoUrl: null, memo: cell.memo,
                                          },
                                        })
                                        setDetailPhotoUrl(null)
                                        setDetailPhotoLoading(true)
                                        setShowDetailModal(true)
                                        fetch(`/api/checkin/${cell.checkinId}`)
                                          .then(r => r.json())
                                          .then(d => setDetailPhotoUrl(d.photoUrl ?? null))
                                          .finally(() => setDetailPhotoLoading(false))
                                      }}
                                    >
                                      ✓
                                    </button>
                                  ) : (
                                    <div className="inline-flex gap-1 items-center">
                                      {[cell?.wokeAt, cell?.startedAt, cell?.finishedAt].map((done, i) => (
                                        <div
                                          key={i}
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: done ? m.color : 'rgba(14,15,12,0.12)' }}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}

                      {/* 휴가 중 멤버 - 테이블 맨 아래 비활성 행 */}
                      {leaveMembers.length > 0 && (
                        <>
                          <tr style={{ borderTop: '1px solid rgba(14,15,12,0.30)', borderBottom: '1px solid rgba(14,15,12,0.06)' }}>
                            <td className="px-4 py-4 sticky left-0 z-10 bg-white" style={{ boxShadow: '1px 0 0 rgba(14,15,12,0.08)' }}>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[15px]">❌</span>
                                <span className="text-[15px] font-[700] text-[#868685]">휴가 중</span>
                              </div>
                            </td>
                            {last7Days.map(({ date }) => <td key={date} className="bg-white" />)}
                          </tr>
                          {leaveMembers.map((m) => (
                            <tr key={m.id} className="border-b border-[rgba(14,15,12,0.06)]">
                              <td className="px-4 py-4 sticky left-0 z-10 bg-white" style={{ boxShadow: '1px 0 0 rgba(14,15,12,0.08)' }}>
                                <div className="flex items-center gap-2.5">
                                  <button
                                    onClick={() => openMonthlyModal(m)}
                                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform cursor-pointer"
                                    style={{ backgroundColor: `${m.color}25`, border: `1.5px solid ${m.color}` }}
                                    title="월간 출석표 보기"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                      <line x1="16" y1="2" x2="16" y2="6"/>
                                      <line x1="8" y1="2" x2="8" y2="6"/>
                                      <line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                  </button>
                                  <span className="text-[15px] font-[700] text-[#868685] whitespace-nowrap opacity-50">{m.name}</span>
                                </div>
                              </td>
                              {last7Days.map(({ date }) => (
                                <td key={date} className="px-4 py-3 text-center">
                                  <div className="h-9 flex items-center justify-center">
                                    <span className="text-[#868685] text-[18px] font-[300]">—</span>
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

          </div>
        )}
      </main>

      <footer className="h-20 bg-[#0e0f0c] mt-10 flex items-center justify-center">
        <span className={`${T.caps} text-[#868685]`}>SUJIMOM MORNING WORKOUT CLUB</span>
      </footer>

      {/* ════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════ */}

      {/* 1. Members Modal */}
      {showMembersModal && (
        <Modal onClose={() => setShowMembersModal(false)}>
          <div className="px-8 py-6 border-b border-[rgba(14,15,12,0.08)] flex justify-between items-center">
            <div>
              <h3 className={`${T.cardTitle} text-[#0e0f0c] mt-1`}>멤버 관리</h3>
            </div>
            <CloseBtn onClick={() => setShowMembersModal(false)} />
          </div>
          <div className="p-3 overflow-y-auto flex-1 flex flex-col gap-3">
            <div>
              {members.length === 0 ? (
                <p className={`${T.small} text-[#868685]`}>아직 등록된 멤버가 없습니다.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 p-4 rounded-[24px] border border-[rgba(14,15,12,0.08)] bg-[#e8ebe6]/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-[700] flex-shrink-0"
                            style={{ backgroundColor: m.color, color: '#163300' }}
                          >
                            {getInitials(m.name)}
                          </div>
                          <div className="text-[15px] font-[700] text-[#0e0f0c]">{m.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleLeave(m)}
                            className={`transition-colors px-2.5 py-1.5 rounded-full border cursor-pointer text-[11px] font-[600] tracking-wide ${
                              m.onLeave
                                ? 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'
                                : 'text-[#868685] hover:text-amber-500 border-[rgba(14,15,12,0.12)]'
                            }`}
                          >
                            {m.onLeave ? '🏥 휴가 중' : '휴가'}
                          </button>
                          <button
                            onClick={() => { setEditingMemberId(m.id); setEditingMemberName(m.name) }}
                            className="w-8 h-8 rounded-full border border-[rgba(14,15,12,0.12)] flex items-center justify-center text-[#868685] hover:bg-[#e8ebe6] hover:text-[#0e0f0c] transition-colors cursor-pointer flex-shrink-0"
                            title="이름 수정"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteMember(m.id, m.name)}
                            className="w-8 h-8 rounded-full border border-[rgba(14,15,12,0.12)] flex items-center justify-center text-[#868685] hover:text-rose-500 hover:border-rose-200 transition-colors cursor-pointer flex-shrink-0"
                            title="멤버 삭제"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/>
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      {editingMemberId === m.id && (
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            value={editingMemberName}
                            onChange={(e) => setEditingMemberName(e.target.value)}
                            maxLength={8}
                            autoFocus
                            className="w-0 flex-1 min-w-0 h-[44px] px-3 rounded-[14px] bg-white border border-[#9fe870] focus:outline-none text-[14px] font-[500]"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameMember(m.id); if (e.key === 'Escape') setEditingMemberId(null) }}
                          />
                          <button
                            onClick={() => handleRenameMember(m.id)}
                            className="px-4 h-[44px] rounded-[14px] bg-[#0e0f0c] text-white text-[14px] font-[700] cursor-pointer"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingMemberId(null)}
                            className="px-4 h-[44px] rounded-[14px] border border-[rgba(14,15,12,0.12)] text-[#868685] text-[14px] font-[700] cursor-pointer"
                          >
                            취소
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleAddMember} className="border-t border-[rgba(14,15,12,0.08)] pt-6 flex flex-col gap-5">
              <div>
                <label className={`${T.small} font-[700] text-[#0e0f0c] block mb-2`}>새로운 멤버 추가</label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="이름 입력 (예: 홍길동)"
                  maxLength={8}
                  required
                  className="w-full h-[52px] px-5 rounded-[16px] bg-[#e8ebe6]/40 border border-[rgba(14,15,12,0.12)] focus:outline-none focus:border-[#9fe870] text-[15px] font-[500] transition-colors"
                  style={{ fontFamily: "'Pretendard', sans-serif" }}
                />
              </div>
              <div>
                <div className="w-full grid grid-cols-6 gap-4 px-3">
                  {COLOR_PALETTE.map(({ hex, name }) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setNewMemberColor(hex)}
                      className="aspect-square rounded-full transition-all cursor-pointer"
                      style={{
                        backgroundColor: hex,
                        boxShadow: newMemberColor === hex ? `0 0 0 3px white, 0 0 0 5px ${hex}` : 'none',
                        transform: newMemberColor === hex ? 'scale(1.15)' : 'scale(1)',
                      }}
                      title={name}
                    />
                  ))}
                </div>
              </div>
              {memberFormError && (
                <p className={`${T.small} text-rose-500 font-[700]`}>{memberFormError}</p>
              )}
              <button
                type="submit"
                disabled={addingMember}
                className={`${T.btnDark} ${T.btnHFull} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {addingMember ? (
                  <><div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />등록 중...</>
                ) : '새 멤버 등록하기'}
              </button>
            </form>
            <div className="pb-8" />
          </div>
        </Modal>
      )}

      {/* 2. Workout Complete Modal */}
      {showCompleteModal && (
        <Modal onClose={closeCompleteModal}>
          <div className="px-8 py-6 border-b border-[rgba(14,15,12,0.08)] flex justify-between items-center">
            <div>
              <span className={`${T.caps} text-[#868685]`}>STEP 03 VERIFICATION</span>
              <h3 className={`${T.cardTitle} text-[#0e0f0c] mt-1`}>운동 완료 인증</h3>
            </div>
            <CloseBtn onClick={closeCompleteModal} />
          </div>
          <form onSubmit={handleCompleted} className="overflow-y-auto flex-1 flex flex-col p-4 gap-4">
            {/* Main Tabs */}
            <div>
              <div className="grid grid-cols-2 gap-2 bg-[#e8ebe6]/50 p-1.5 rounded-[20px] border border-[rgba(14,15,12,0.08)]">
                <button
                  type="button"
                  onClick={() => { setPhotoMode('gallery') }}
                  className={`h-10 rounded-[14px] text-[13px] font-[700] transition-all flex items-center justify-center cursor-pointer ${
                    ['gallery', 'camera', 'file'].includes(photoMode) ? 'bg-white text-[#0e0f0c] shadow-sm' : 'bg-transparent text-[#868685] hover:text-[#0e0f0c]'
                  }`}
                >
                  파일 업로드
                </button>
                <button
                  type="button"
                  onClick={() => { setPhotoMode('preset') }}
                  className={`h-10 rounded-[14px] text-[13px] font-[700] transition-all flex items-center justify-center cursor-pointer ${
                    photoMode === 'preset' ? 'bg-white text-[#0e0f0c] shadow-sm' : 'bg-transparent text-[#868685] hover:text-[#0e0f0c]'
                  }`}
                >
                  기본 그래픽
                </button>
              </div>
            </div>

            {/* File Upload 드롭존 */}
            {['gallery', 'camera', 'file'].includes(photoMode) && !photoPreview && (
              <div
                className="border-2 border-dashed border-[rgba(14,15,12,0.15)] rounded-[24px] p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#9fe870] transition-colors"
                onClick={() => document.getElementById('file-input-gallery')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
              >
                <div className="p-3 bg-[#e8ebe6] rounded-full text-[#868685] mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-[15px] font-[700] text-[#0e0f0c]">여기에 운동 인증 사진을 놓아주세요</p>
                <p className={`${T.small} text-[#868685] mt-1`}>또는 클릭하여 파일 선택 (최대 5MB)</p>
              </div>
            )}
            <input
              type="file" id="file-input-hidden" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
            />
            <input
              type="file" id="file-input-gallery" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
            />
            <input
              type="file" id="file-input-camera" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
            />

            {/* Presets */}
            {photoMode === 'preset' && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {WORKOUT_PRESETS.map((p) => {
                    const dataUrl = makePresetDataUrl(p.emoji, p.bg, p.label)
                    const isActive = photoPreview === dataUrl
                    return (
                      <button
                        key={p.id} type="button"
                        onClick={() => { setPhotoPreview(dataUrl); setPhotoFile(null); setPhotoIsPreset(true) }}
                        className={`rounded-[16px] overflow-hidden border-2 transition-all cursor-pointer ${
                          isActive ? 'border-[#9fe870] scale-[1.02]' : 'border-transparent hover:border-[#9fe870]/50'
                        }`}
                      >
                        <img src={dataUrl} alt={p.label} className="w-full h-auto object-contain" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Photo preview */}
            {photoPreview && (
              <div className="flex flex-col gap-2 border border-[rgba(14,15,12,0.08)] bg-[#e8ebe6]/20 p-4 rounded-[24px] relative">
                <div className="flex items-center justify-between">
                  <span className={`${T.caps} text-[#868685]`}>등록 예정 인증 미리보기</span>
                  {['gallery', 'file'].includes(photoMode) && (
                    <button
                      type="button"
                      onClick={() => document.getElementById('file-input-hidden')?.click()}
                      className={`${T.caps} text-[#868685] hover:text-[#0e0f0c] transition-colors px-3 py-1.5 rounded-full border border-[rgba(14,15,12,0.12)] cursor-pointer`}
                    >
                      사진 바꾸기
                    </button>
                  )}
                </div>
                <div className="w-full rounded-[20px] bg-neutral-100 overflow-hidden">
                  <img src={photoPreview} alt="Preview" className="w-full h-auto object-contain" />
                </div>
                <button
                  type="button"
                  onClick={() => { setPhotoPreview(null); setPhotoFile(null); setPhotoIsPreset(false) }}
                  className="absolute top-14 right-6 p-2 rounded-full bg-black/60 hover:bg-black text-white transition-colors cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            )}

            {/* Memo */}
            <div>
              <label className={`${T.small} font-[700] text-[#0e0f0c] block mb-2`}>
                다짐 한 줄 일기 / 모닝 루틴 메모 <span className="text-[#868685] font-[500]">(선택)</span>
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="오늘 아침 운동은 어땠나요? (예: 상쾌한 공기 마시며 5k 완주!)"
                maxLength={60}
                className="w-full h-[52px] px-5 rounded-[16px] bg-[#e8ebe6]/40 border border-[rgba(14,15,12,0.12)] focus:outline-none focus:border-[#9fe870] text-[15px] font-[500] transition-colors"
                style={{ fontFamily: "'Pretendard', sans-serif" }}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-[rgba(14,15,12,0.08)]">
              <button type="button" onClick={closeCompleteModal} className={`flex-1 ${T.btnGhost} h-[52px]`}>
                인증 취소
              </button>
              <button
                type="submit" disabled={submitting}
                className={`flex-1 ${T.btnDark} h-[52px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />등록 중...</>
                ) : '인증 완료 등록'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Routine Detail Modal */}
      {showDetailModal && detailData && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => { setShowDetailModal(false); setDetailPhotoUrl(null); setDetailPhotoLoading(false) }}
        >
          <div
            className="bg-white w-full max-w-lg rounded-[36px] overflow-hidden relative"
            style={{ boxShadow: '0 0 0 1px rgba(14,15,12,0.12), 0 32px 64px -16px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setShowDetailModal(false); setDetailPhotoUrl(null); setDetailPhotoLoading(false) }}
              className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full z-10 transition-colors cursor-pointer"
              style={{ border: '1px solid rgba(255,255,255,0.35)' }}
            >
              <XIcon size={18} />
            </button>
            {detailPhotoLoading && (
              <div className="w-full aspect-square bg-neutral-100 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-t-transparent border-neutral-300 rounded-full animate-spin" />
              </div>
            )}
            {!detailPhotoLoading && detailPhotoUrl && (
              <div className="w-full bg-neutral-100 overflow-hidden">
                <img
                  src={detailPhotoUrl} alt="인증 사진" className="w-full h-auto block"
                  onLoad={(e) => {
                    const img = e.currentTarget
                    const container = img.parentElement
                    if (container && img.naturalHeight > img.naturalWidth) {
                      container.style.aspectRatio = '1'
                      container.style.display = 'flex'
                      container.style.alignItems = 'center'
                    }
                  }}
                />
              </div>
            )}
            <div className="p-5 relative">
              {/* 스탬프 - 사진 영역 위로 넘어가도록 absolute */}
              <img
                src="/stamp.svg" alt="완료 스탬프"
                className="absolute w-24 h-24 pointer-events-none"
                style={{ top: '-25px', right: '16px', transform: 'rotate(-15deg)', filter: 'brightness(0) saturate(100%) invert(13%) sepia(95%) saturate(6000%) hue-rotate(5deg) brightness(90%) contrast(110%)' }}
              />
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-[700] flex-shrink-0"
                  style={{ backgroundColor: detailData.member.color, color: '#163300' }}
                >
                  {getInitials(detailData.member.name)}
                </div>
                <div>
                  <div className="text-[16px] font-[700] text-[#0e0f0c]">{detailData.member.name}</div>
                  <div className={`${T.small} text-[#868685]`}>
                    {new Date(detailData.date + 'T12:00:00+09:00').toLocaleDateString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
                    })}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: '기상', time: detailData.checkin.wokeAt },
                  { label: '운동 시작', time: detailData.checkin.startedAt },
                  { label: '완료', time: detailData.checkin.finishedAt },
                ].map(({ label, time }) => (
                  <div key={label} className="bg-[#e8ebe6]/50 rounded-[16px] p-3 text-center">
                    <div className={`${T.caps} text-[#868685] mb-1`}>{label}</div>
                    <div className="text-[18px] font-[700] font-mono text-[#0e0f0c]">{formatKSTTime(time)}</div>
                  </div>
                ))}
              </div>
              {detailData.checkin.memo && (
                <div className="bg-[#e8ebe6]/50 rounded-[16px] p-3">
                  <div className={`${T.caps} text-[#868685] mb-1`}>오늘의 메모</div>
                  <p className={`${T.small} text-[#0e0f0c] italic`}>{`"${detailData.checkin.memo}"`}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Confirm Dialog */}
      {showConfirmModal && confirmConfig && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div
            className="bg-white w-full max-w-sm rounded-[30px] border border-[rgba(14,15,12,0.12)] p-8 flex flex-col"
            style={{ boxShadow: '0 0 0 1px rgba(14,15,12,0.12), 0 24px 48px -12px rgba(0,0,0,0.2)' }}
          >
            <div className="mb-8 text-center">
              <span className={`${T.caps} text-rose-500`}>SYSTEM MESSAGE</span>
              <h3 className={`${T.cardTitle} text-[#0e0f0c] mt-2`}>{confirmConfig.title}</h3>
              <p className={`${T.small} text-[#868685] mt-2 leading-relaxed`}>{confirmConfig.desc}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className={`flex-1 ${T.btnGhost} h-[52px]`}
              >
                취소
              </button>
              <button
                onClick={() => { confirmConfig.onOk(); setShowConfirmModal(false) }}
                className="flex-1 h-[52px] rounded-full bg-rose-500 hover:bg-rose-600 text-white text-[16px] font-[700] cursor-pointer transition-colors"
              >
                {confirmConfig.okLabel ?? '네, 삭제합니다'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div
            className="bg-white w-full max-w-sm rounded-[30px] border border-[rgba(14,15,12,0.12)] p-8 flex flex-col"
            style={{ boxShadow: '0 0 0 1px rgba(14,15,12,0.12), 0 24px 48px -12px rgba(0,0,0,0.2)' }}
          >
            <div className="mb-8 text-center">
              <span className={`${T.caps} text-amber-500`}>NOTIFICATION</span>
              <p className={`${T.body} text-[#0e0f0c] mt-3 whitespace-pre-wrap`}>{alertMessage}</p>
            </div>
            <button
              onClick={() => setShowAlertModal(false)}
              className={`${T.btnDark} ${T.btnHFull}`}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 6. Monthly Attendance Modal */}
      {showMonthlyModal && monthlyMember && (() => {
        const now = new Date(getKSTDateString() + 'T00:00:00.000Z')
        const y = now.getUTCFullYear()
        const mo = now.getUTCMonth() + 1 + monthlyOffset
        const targetDate = new Date(Date.UTC(y, mo - 1, 1))
        const year = targetDate.getUTCFullYear()
        const month = targetDate.getUTCMonth() + 1
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
        const firstDow = targetDate.getUTCDay() // 0=일
        const startPad = firstDow === 0 ? 6 : firstDow - 1 // 월요일 시작
        const todayStr2 = getKSTDateString()

        // 통계
        const completedDays = monthlyData.filter(d => {
          const cell = d.cells.find(c => c.memberId === monthlyMember.id)
          return cell?.finishedAt
        }).length
        const pastDays = monthlyData.filter(d => d.date <= todayStr2).length
        const completionRate = pastDays > 0 ? Math.round((completedDays / pastDays) * 100) : 0

        // 연속 streak (오늘 기준 역순)
        let streak = 0
        const sortedDates = [...monthlyData].sort((a, b) => b.date.localeCompare(a.date))
        for (const d of sortedDates) {
          if (d.date > todayStr2) continue
          const cell = d.cells.find(c => c.memberId === monthlyMember.id)
          if (cell?.finishedAt) streak++
          else break
        }

        const weekdays = ['월', '화', '수', '목', '금', '토', '일']

        return (
          <Modal onClose={() => setShowMonthlyModal(false)}>
            {/* 헤더 */}
            <div className="px-5 pt-5 pb-0 flex-shrink-0">
              {/* 1행: 멤버명 가운데 + X 오른쪽 */}
              <div className="relative flex items-center justify-center mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-[700]"
                    style={{ backgroundColor: monthlyMember.color, color: '#163300' }}>
                    {getInitials(monthlyMember.name)}
                  </div>
                  <span className="text-[18px] font-[700] text-[#0e0f0c]">{monthlyMember.name}</span>
                </div>
                <div className="absolute right-0">
                  <CloseBtn onClick={() => setShowMonthlyModal(false)} />
                </div>
              </div>
              {/* 2행: 날짜 네비게이터 가운데 */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <button
                  onClick={() => { const o = monthlyOffset - 1; setMonthlyOffset(o); fetchMonthlyData(monthlyMember, o) }}
                  className="w-7 h-7 rounded-full border border-[rgba(14,15,12,0.12)] flex items-center justify-center hover:bg-[#e8ebe6] transition-colors cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span className="text-[18px] font-[700] text-[#0e0f0c] min-w-[90px] text-center">
                  {year}년 {month}월
                </span>
                <button
                  onClick={() => { const o = monthlyOffset + 1; setMonthlyOffset(o); fetchMonthlyData(monthlyMember, o) }}
                  disabled={monthlyOffset >= 0}
                  className="w-7 h-7 rounded-full border border-[rgba(14,15,12,0.12)] flex items-center justify-center hover:bg-[#e8ebe6] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
              <div className="border-b border-[rgba(14,15,12,0.08)]" />
            </div>

            {/* 캘린더 */}
            <div className="px-4 pt-3 pb-4 overflow-y-auto flex-1">
              {monthlyLoading ? (
                <div className="py-12 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-t-transparent border-[#0e0f0c] rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* 요일 헤더 */}
                  <div className="grid grid-cols-7 mb-3">
                    {weekdays.map(d => (
                      <div key={d} className="text-center text-[13px] font-[700] py-1 uppercase tracking-widest" style={{ color: '#868685' }}>{d}</div>
                    ))}
                  </div>
                  {/* 날짜 셀 */}
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1
                      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                      const isFuture = dateStr > todayStr2
                      const isToday = dateStr === todayStr2
                      const dayData = monthlyData.find(d => d.date === dateStr)
                      const cell = dayData?.cells.find(c => c.memberId === monthlyMember.id)
                      const stepCount = cell ? [cell.wokeAt, cell.startedAt, cell.finishedAt].filter(Boolean).length : 0
                      const isDone = stepCount === 3

                      return (
                        <div key={dateStr} className={`flex flex-col items-center gap-1 py-2 rounded-[10px] ${isToday ? 'bg-[#e8ebe6]/60' : ''}`}>
                          <span className={`text-[13px] ${isToday ? 'font-[700]' : 'font-[500]'} ${isFuture ? 'text-[#ccc]' : 'text-[#868685]'}`}>{dayNum}</span>
                          <div className="h-8 flex items-center justify-center">
                            {isFuture ? null : isDone ? (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] font-[700]"
                                style={{ backgroundColor: monthlyMember.color, color: '#163300' }}>✓</div>
                            ) : stepCount > 0 ? (
                              <div className="flex gap-0.5">
                                {[cell?.wokeAt, cell?.startedAt, cell?.finishedAt].map((done, j) => (
                                  <div key={j} className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: done ? monthlyMember.color : 'rgba(14,15,12,0.12)' }} />
                                ))}
                              </div>
                            ) : monthlyMember.onLeave ? (
                              <span className="text-[9px] font-[600] text-amber-400">휴가중</span>
                            ) : (
                              <span className="text-[11px] text-[rgba(14,15,12,0.2)] font-[300]">—</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 통계 */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 pb-3 border-t border-[rgba(14,15,12,0.08)]">
                    {[
                      { label: '완료', value: `${completedDays}일` },
                      { label: '완료율', value: `${completionRate}%` },
                      { label: '연속', value: `${streak}일` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[#e8ebe6]/40 rounded-[14px] p-2.5 text-center">
                        <div className={`${T.caps} text-[#868685] mb-0.5`}>{label}</div>
                        <div className="text-[18px] font-[800] text-[#0e0f0c]">{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Modal>
        )
      })()}

      {/* 7. Member Select Modal */}
      {showMemberSelectModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowMemberSelectModal(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-[36px] border border-[rgba(14,15,12,0.12)] flex flex-col max-h-[90vh] overflow-hidden"
            style={{ boxShadow: '0 0 0 1px rgba(14,15,12,0.12), 0 32px 64px -16px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-[rgba(14,15,12,0.08)] flex justify-between items-center flex-shrink-0">
              <h3 className={`${T.cardTitle} text-[#0e0f0c]`}>멤버 선택</h3>
              <CloseBtn onClick={() => setShowMemberSelectModal(false)} />
            </div>
            <div className="p-3 overflow-y-auto">
              {members.map((m) => {
                const isSelected = selectedMemberId === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => { selectMember(m); setShowMemberSelectModal(false) }}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-[20px] transition-colors cursor-pointer hover:bg-[#e8ebe6]/40"
                    style={{ backgroundColor: isSelected ? `${m.color}22` : undefined }}
                  >
                    {/* Radio indicator */}
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        borderColor: isSelected ? m.color : 'rgba(14,15,12,0.2)',
                        backgroundColor: isSelected ? m.color : 'transparent',
                      }}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    {/* Color dot */}
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                    {/* Name */}
                    <span className="text-[15px] font-[700] text-[#0e0f0c] flex-1 text-left">{m.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
