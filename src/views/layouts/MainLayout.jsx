import React, { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, orderBy, query, limit, updateDoc, doc, writeBatch, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useMessages } from '../../contexts/MessagesContext'
import { MessagesPanel } from '../components/messages/MessagesPanel'

const TYPE_ICON = {
  message:  { icon: 'bi-chat-dots-fill',    bg: 'bg-indigo-100',  text: 'text-indigo-600' },
  bill:     { icon: 'bi-receipt',            bg: 'bg-amber-100',   text: 'text-amber-600' },
  payment:  { icon: 'bi-cash-coin',          bg: 'bg-emerald-100', text: 'text-emerald-600' },
  inquiry:  { icon: 'bi-envelope-fill',      bg: 'bg-violet-100',  text: 'text-violet-600' },
  chore:    { icon: 'bi-check2-circle',      bg: 'bg-teal-100',    text: 'text-teal-600' },
  approval: { icon: 'bi-patch-check-fill',   bg: 'bg-emerald-100', text: 'text-emerald-600' },
  moveout:  { icon: 'bi-box-arrow-right',    bg: 'bg-rose-100',    text: 'text-rose-600' },
  default:  { icon: 'bi-bell-fill',          bg: 'bg-slate-100',   text: 'text-slate-600' },
}

export const MainLayout = ({ children, onLogout, currentUser }) => {
  const name = currentUser ? (currentUser.fullName || currentUser.name || 'User').split(' ')[0] : null
  const role = currentUser?.role === 'owner' ? 'Landlord' : 'Tenant'
  const initials = name ? name.charAt(0).toUpperCase() : ''
  const photo = currentUser?.profilePhoto || ''

  const [notifs, setNotifs] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const panelRef = useRef(null)
  const { showPanel, togglePanel } = useMessages()

  useEffect(() => {
    if (!currentUser?.uid) return
    const q = query(
      collection(db, 'notifications', currentUser.uid, 'items'),
      orderBy('createdAt', 'desc'),
      limit(30)
    )
    return onSnapshot(q, snap => setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [currentUser?.uid])

  useEffect(() => {
    if (!currentUser?.uid) return
    const isOwner = currentUser.role === 'owner'
    const field = isOwner ? 'landlordUid' : 'tenantUid'
    const unreadField = isOwner ? 'unreadByOwner' : 'unreadByTenant'
    const q = query(collection(db, 'inquiries'), where(field, '==', currentUser.uid))
    return onSnapshot(q, snap => {
      const count = snap.docs.filter(d => d.data()[unreadField] === true).length
      setUnreadChatCount(count)
    })
  }, [currentUser?.uid, currentUser?.role])

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unreadCount = notifs.filter(n => !n.read).length

  const markAllRead = async () => {
    if (!currentUser?.uid) return
    const unread = notifs.filter(n => !n.read)
    if (unread.length === 0) return
    const batch = writeBatch(db)
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', currentUser.uid, 'items', n.id), { read: true })
    })
    await batch.commit()
  }

  const markOneRead = async (id) => {
    if (!currentUser?.uid) return
    await updateDoc(doc(db, 'notifications', currentUser.uid, 'items', id), { read: true })
  }

  const handleBellClick = () => {
    setShowNotifs(v => !v)
  }

  const formatTime = (ts) => {
    if (!ts?.seconds) return ''
    const d = new Date(ts.seconds * 1000)
    const now = new Date()
    const diffMin = Math.floor((now - d) / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  }

  return (
    <div className='min-h-screen flex flex-col bg-slate-50'>
      {/* Top Nav */}
      <header className='sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm'>
        <div className='max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4'>
          {/* Logo */}
          <div className='flex items-center gap-2.5'>
            <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-brand-sm'>
              <svg className='w-4 h-4 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M13 10V3L4 14h7v7l9-11h-7z' />
              </svg>
            </div>
            <span className='text-lg font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Sked<span className='text-indigo-600'>Link</span>
            </span>
          </div>

          {/* Right side */}
          {currentUser ? (
            <div className='flex items-center gap-2'>
              {/* Messages Icon */}
              <button
                onClick={togglePanel}
                className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                  showPanel
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title='Messages'
              >
                <i className='bi bi-chat-dots text-base' />
                {unreadChatCount > 0 && (
                  <span className='absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none'>
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </button>

              {/* Notification Bell */}
              <div className='relative' ref={panelRef}>
                <button
                  onClick={handleBellClick}
                  className='relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all'
                  title='Notifications'
                >
                  <i className='bi bi-bell text-base' />
                  {unreadCount > 0 && (
                    <span className='absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none'>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className='absolute right-0 top-11 w-80 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-50'>
                    <div className='flex items-center justify-between px-4 py-3 border-b border-slate-100'>
                      <p className='font-bold text-slate-900 text-sm' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                        Notifications {unreadCount > 0 && <span className='text-indigo-600'>({unreadCount})</span>}
                      </p>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className='text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors'
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className='max-h-96 overflow-y-auto'>
                      {notifs.length === 0 ? (
                        <div className='flex flex-col items-center justify-center py-10 gap-2 text-slate-400'>
                          <i className='bi bi-bell-slash text-3xl' />
                          <p className='text-xs'>No notifications yet</p>
                        </div>
                      ) : (
                        notifs.map(n => {
                          const cfg = TYPE_ICON[n.type] || TYPE_ICON.default
                          return (
                            <div
                              key={n.id}
                              onClick={() => markOneRead(n.id)}
                              className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${!n.read ? 'bg-indigo-50/60' : ''}`}
                            >
                              <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                <i className={`bi ${cfg.icon} ${cfg.text} text-sm`} />
                              </div>
                              <div className='flex-1 min-w-0'>
                                <p className={`text-xs font-semibold leading-tight ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>
                                  {n.title}
                                </p>
                                <p className='text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2'>{n.body}</p>
                                <p className='text-[10px] text-slate-400 mt-1'>{formatTime(n.createdAt)}</p>
                              </div>
                              {!n.read && (
                                <span className='w-2 h-2 bg-indigo-500 rounded-full shrink-0 mt-1.5' />
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className='hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl'>
                <div className='w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0'>
                  {photo
                    ? <img src={photo} alt='' className='w-full h-full object-cover' />
                    : <span className='text-xs font-bold text-white'>{initials}</span>
                  }
                </div>
                <div className='leading-tight'>
                  <p className='text-xs font-semibold text-slate-900'>{name}</p>
                  <p className='text-[10px] text-slate-400'>{role}</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className='flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all'
              >
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
                </svg>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className='flex-1'>
        {children}
      </main>

      {currentUser && <MessagesPanel currentUser={currentUser} />}
    </div>
  )
}
