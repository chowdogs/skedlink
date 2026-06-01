import React, { useState, useEffect, useRef } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, updateDoc, arrayUnion, setDoc, getDoc
} from 'firebase/firestore'
import { db } from '../../../firebase'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'

const fmtTime = (ts) => {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const STATUS_VARIANT = { pending: 'warning', active: 'success', approved: 'success', closed: 'danger' }

const Avatar = ({ photo, name, size = 7 }) => (
  <div className={`w-${size} h-${size} rounded-full overflow-hidden bg-indigo-100 border border-indigo-200 shrink-0 flex items-center justify-center`}>
    {photo
      ? <img src={photo} alt='' className='w-full h-full object-cover' />
      : <span className='text-xs font-bold text-indigo-600'>{(name || '?').charAt(0).toUpperCase()}</span>
    }
  </div>
)

export const ChatModal = ({ inquiry, currentUser, onClose }) => {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [approving, setApproving] = useState(false)
  const bottomRef = useRef(null)
  const isOwner = currentUser.uid === inquiry.landlordUid

  useEffect(() => {
    const q = query(
      collection(db, 'inquiries', inquiry.id, 'messages'),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    updateDoc(doc(db, 'inquiries', inquiry.id), {
      [isOwner ? 'unreadByOwner' : 'unreadByTenant']: false
    }).catch(() => {})
    return unsub
  }, [inquiry.id, isOwner])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setText('')
    try {
      await addDoc(collection(db, 'inquiries', inquiry.id, 'messages'), {
        senderId: currentUser.uid,
        senderName: currentUser.fullName || currentUser.name || 'User',
        senderPhoto: currentUser.profilePhoto || '',
        text: trimmed,
        createdAt: serverTimestamp()
      })
      await updateDoc(doc(db, 'inquiries', inquiry.id), {
        lastMessage: trimmed,
        lastMessageAt: serverTimestamp(),
        status: inquiry.status === 'pending' ? 'active' : inquiry.status,
        [isOwner ? 'unreadByTenant' : 'unreadByOwner']: true
      })
    } catch {
      setText(trimmed)
    } finally {
      setSending(false)
    }
  }

  const handleApprove = async () => {
    if (!window.confirm(`Approve ${inquiry.tenantName} as a tenant for ${inquiry.propertyTitle}?`)) return
    setApproving(true)
    try {
      let tenantPhoto = ''
      try {
        const snap = await getDoc(doc(db, 'users', inquiry.tenantUid))
        if (snap.exists()) tenantPhoto = snap.data().profilePhoto || ''
      } catch {}

      await updateDoc(doc(db, 'properties', inquiry.propertyId), {
        tenants: arrayUnion(inquiry.tenantUid),
        [`tenantDetails.${inquiry.tenantUid}`]: {
          name: inquiry.tenantName,
          email: inquiry.tenantEmail,
          phone: inquiry.tenantPhone || '',
          profilePhoto: tenantPhoto
        }
      })
      await updateDoc(doc(db, 'inquiries', inquiry.id), {
        status: 'approved',
        unreadByTenant: true
      })
      await setDoc(doc(db, 'propertyChats', inquiry.propertyId), {
        participantUids: arrayUnion(inquiry.tenantUid, inquiry.landlordUid),
        participantNames: {
          [inquiry.tenantUid]: inquiry.tenantName,
          [inquiry.landlordUid]: currentUser.fullName || currentUser.name || 'Landlord'
        },
        propertyTitle: inquiry.propertyTitle
      }, { merge: true })
      await addDoc(collection(db, 'inquiries', inquiry.id, 'messages'), {
        senderId: currentUser.uid,
        senderName: currentUser.fullName || currentUser.name || 'Landlord',
        senderPhoto: currentUser.profilePhoto || '',
        text: `Your application to rent ${inquiry.propertyTitle} has been approved! Welcome aboard.`,
        createdAt: serverTimestamp(),
        isSystem: true
      })
    } catch (err) {
      alert('Approval failed: ' + err.message)
    } finally {
      setApproving(false)
    }
  }

  const canApprove = isOwner && inquiry.type === 'rent' && inquiry.status !== 'approved'

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6'>
      <div
        className='w-full max-w-lg flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden'
        style={{ height: 'min(90vh, 640px)' }}
      >
        {/* Header */}
        <div className='px-5 py-4 border-b border-slate-100 bg-white shrink-0'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <h2 className='font-semibold text-slate-900 truncate text-base'>{inquiry.propertyTitle}</h2>
              {isOwner ? (
                <p className='text-xs text-slate-500 mt-0.5'>
                  {inquiry.tenantName} · {inquiry.tenantEmail}
                  {inquiry.tenantPhone ? ` · ${inquiry.tenantPhone}` : ''}
                </p>
              ) : (
                <p className='text-xs text-slate-500 mt-0.5'>Landlord</p>
              )}
              <p className='text-xs text-slate-500 mt-0.5 font-medium'>
                {inquiry.type === 'rent' ? 'Wants to rent' : 'Wants to schedule a visit'}
              </p>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              <Badge variant={STATUS_VARIANT[inquiry.status] || 'warning'}>
                {inquiry.status}
              </Badge>
              <button
                type='button'
                onClick={onClose}
                className='text-slate-400 hover:text-slate-700 text-2xl font-light leading-none'
              >
                ×
              </button>
            </div>
          </div>

          {inquiry.message && (
            <div className='mt-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100'>
              <p className='text-xs text-slate-400 mb-0.5'>Initial message</p>
              <p className='text-sm text-slate-600 italic'>"{inquiry.message}"</p>
            </div>
          )}

          {canApprove && (
            <button
              type='button'
              onClick={handleApprove}
              disabled={approving}
              className='mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60'
            >
              {approving ? 'Approving...' : '✓ Approve as Tenant'}
            </button>
          )}

          {inquiry.status === 'approved' && (
            <div className='mt-3 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2'>
              <svg className='w-4 h-4 text-emerald-600 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
              </svg>
              <p className='text-sm text-emerald-700 font-medium'>Tenant approved</p>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className='flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0 bg-slate-50'>
          {messages.length === 0 ? (
            <div className='flex items-center justify-center h-full'>
              <p className='text-sm text-slate-400 text-center'>
                {isOwner
                  ? 'Reply to start the conversation, or approve above.'
                  : 'Waiting for the landlord to reply.'}
              </p>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.senderId === currentUser.uid
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className='flex justify-center'>
                    <div className='px-4 py-2 bg-emerald-100 rounded-full border border-emerald-200'>
                      <p className='text-xs text-emerald-700 font-medium text-center'>{msg.text}</p>
                    </div>
                  </div>
                )
              }
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && <Avatar photo={msg.senderPhoto} name={msg.senderName} />}
                  <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-br-md'
                      : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-100'
                  }`}>
                    {!isMe && (
                      <p className='text-xs font-semibold mb-1 text-indigo-600'>{msg.senderName}</p>
                    )}
                    <p className='text-sm leading-relaxed'>{msg.text}</p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>
                      {fmtTime(msg.createdAt)}
                    </p>
                  </div>
                  {isMe && <Avatar photo={currentUser.profilePhoto} name={currentUser.fullName || currentUser.name} />}
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className='px-4 py-3 border-t border-slate-100 bg-white shrink-0'>
          <div className='flex gap-2'>
            <input
              type='text'
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder='Type a message...'
              className='flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
            />
            <Button
              onClick={send}
              variant='primary'
              disabled={!text.trim() || sending}
              className='shrink-0'
            >
              {sending ? '...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
