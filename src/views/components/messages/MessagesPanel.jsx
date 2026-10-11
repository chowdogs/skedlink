import React, { useState, useEffect, useRef } from 'react'
import {
  collection, query, where, onSnapshot, orderBy,
  addDoc, updateDoc, doc, serverTimestamp,
  setDoc
} from 'firebase/firestore'
import { db } from '../../../firebase'
import { useMessages } from '../../../contexts/MessagesContext'
import { ConfirmModal } from '../../ui/ConfirmModal'
import { Badge } from '../../ui/Badge'

const fmtTime = (ts) => {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const Avatar = ({ photo, name }) => (
  <div className='w-8 h-8 rounded-full overflow-hidden bg-indigo-100 border border-indigo-200 shrink-0 flex items-center justify-center'>
    {photo
      ? <img src={photo} alt='' className='w-full h-full object-cover' />
      : <span className='text-xs font-bold text-indigo-600'>{(name || '?').charAt(0).toUpperCase()}</span>
    }
  </div>
)

// ── INQUIRY CHAT VIEW ─────────────────────────────────────────────────────────

const InquiryChatView = ({ inquiry, currentUser, setDialog }) => {
  const { closePanel } = useMessages()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
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

  const handleApprove = () => { closePanel(); window.dispatchEvent(new CustomEvent('skedlink:navigate', { detail: { tab: 'applications' } })) }

  const STATUS_VARIANT = { pending: 'warning', active: 'primary', approved: 'success', closed: 'danger' }
  const canApprove = isOwner && inquiry.type === 'rent' && inquiry.status !== 'approved'

  return (
    <div className='flex flex-col h-full'>
      <div className='px-5 py-4 border-b border-slate-100 bg-white shrink-0'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h3 className='font-semibold text-slate-900 truncate'>{inquiry.propertyTitle}</h3>
            {isOwner
              ? <p className='text-xs text-slate-500 mt-0.5'>{inquiry.tenantName} · {inquiry.tenantEmail}</p>
              : <p className='text-xs text-slate-500 mt-0.5'>Inquiry with landlord</p>
            }
            <p className='text-xs text-slate-400 mt-0.5'>{inquiry.type === 'rent' ? 'Wants to rent' : 'Wants to visit'}</p>
          </div>
          <Badge variant={STATUS_VARIANT[inquiry.status] || 'warning'}>{inquiry.status}</Badge>
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
            className='mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors'
          >
            ✓ Approve as Tenant
          </button>
        )}

        {inquiry.status === 'approved' && (
          <div className='mt-3 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2'>
            <i className='bi bi-patch-check-fill text-emerald-600' />
            <p className='text-sm text-emerald-700 font-medium'>Tenant approved</p>
          </div>
        )}
      </div>

      <div className='flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-slate-50 min-h-0'>
        {messages.length === 0 ? (
          <div className='flex items-center justify-center h-full'>
            <p className='text-sm text-slate-400 text-center'>
              {isOwner ? 'Reply to start the conversation.' : 'Waiting for the landlord to reply.'}
            </p>
          </div>
        ) : messages.map(msg => {
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
              <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl ${isMe ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-100'}`}>
                {!isMe && <p className='text-xs font-semibold mb-1 text-indigo-600'>{msg.senderName}</p>}
                <p className='text-sm leading-relaxed'>{msg.text}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>{fmtTime(msg.createdAt)}</p>
              </div>
              {isMe && <Avatar photo={currentUser.profilePhoto} name={currentUser.fullName || currentUser.name} />}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className='px-4 py-3 border-t border-slate-100 bg-white shrink-0 flex gap-2'>
        <input
          type='text'
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder='Type a message...'
          className='flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className='px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors'
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ── DM CHAT VIEW ──────────────────────────────────────────────────────────────

const DMChatView = ({ currentUser, otherUser }) => {
  const chatId = [currentUser.uid, otherUser.uid].sort().join('_')
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const q = query(
      collection(db, 'directMessages', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    )
    return onSnapshot(q, snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [chatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    const payload = text.trim()
    setText('')
    try {
      await setDoc(doc(db, 'directMessages', chatId), {
        participants: [currentUser.uid, otherUser.uid],
        participantNames: {
          [currentUser.uid]: currentUser.fullName || currentUser.name || '',
          [otherUser.uid]: otherUser.name || ''
        }
      }, { merge: true })
      await addDoc(collection(db, 'directMessages', chatId, 'messages'), {
        senderUid: currentUser.uid,
        senderName: currentUser.fullName || currentUser.name || 'User',
        senderPhoto: currentUser.profilePhoto || '',
        text: payload,
        createdAt: serverTimestamp()
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className='flex flex-col h-full'>
      <div className='px-5 py-4 border-b border-slate-100 bg-white shrink-0 flex items-center gap-3'>
        <Avatar photo={otherUser.profilePhoto} name={otherUser.name} />
        <div>
          <h3 className='font-semibold text-slate-900'>{otherUser.name}</h3>
          <p className='text-xs text-slate-400'>Direct Message</p>
        </div>
      </div>

      <div className='flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 min-h-0'>
        {messages.length === 0 && <p className='text-center text-sm text-slate-400 py-8'>No messages yet. Say hello!</p>}
        {messages.map(msg => {
          const isMe = msg.senderUid === currentUser.uid
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && <Avatar photo={msg.senderPhoto} name={msg.senderName} />}
              <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl ${isMe ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-100'}`}>
                <p className='text-sm leading-relaxed'>{msg.text}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>{fmtTime(msg.createdAt)}</p>
              </div>
              {isMe && <Avatar photo={currentUser.profilePhoto} name={currentUser.fullName || currentUser.name} />}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className='px-4 py-3 border-t border-slate-100 bg-white shrink-0 flex gap-2'>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
          placeholder='Type a message...'
          className='flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className='px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors'
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ── GROUP CHAT VIEW ───────────────────────────────────────────────────────────

const GroupChatView = ({ currentUser, propertyId, propertyTitle }) => {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const q = query(
      collection(db, 'propertyChats', propertyId, 'messages'),
      orderBy('createdAt', 'asc')
    )
    return onSnapshot(q, snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [propertyId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    const payload = text.trim()
    setText('')
    try {
      await addDoc(collection(db, 'propertyChats', propertyId, 'messages'), {
        senderUid: currentUser.uid,
        senderName: currentUser.fullName || currentUser.name || 'User',
        senderPhoto: currentUser.profilePhoto || '',
        text: payload,
        createdAt: serverTimestamp()
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className='flex flex-col h-full'>
      <div className='px-5 py-4 border-b border-slate-100 bg-white shrink-0 flex items-center gap-3'>
        <div className='w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0'>
          <i className='bi bi-people-fill text-white text-sm' />
        </div>
        <div>
          <h3 className='font-semibold text-slate-900'>Group Chat</h3>
          <p className='text-xs text-slate-400'>{propertyTitle}</p>
        </div>
      </div>

      <div className='flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 min-h-0'>
        {messages.length === 0 && <p className='text-center text-sm text-slate-400 py-8'>No messages yet. Start the conversation!</p>}
        {messages.map(msg => {
          const isMe = msg.senderUid === currentUser.uid
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && <Avatar photo={msg.senderPhoto} name={msg.senderName} />}
              <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl ${isMe ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-100'}`}>
                {!isMe && <p className='text-xs font-semibold mb-1 text-indigo-600'>{msg.senderName}</p>}
                <p className='text-sm leading-relaxed'>{msg.text}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>{fmtTime(msg.createdAt)}</p>
              </div>
              {isMe && <Avatar photo={currentUser.profilePhoto} name={currentUser.fullName || currentUser.name} />}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className='px-4 py-3 border-t border-slate-100 bg-white shrink-0 flex gap-2'>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
          placeholder='Type a message...'
          className='flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className='px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors'
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ── MAIN PANEL ────────────────────────────────────────────────────────────────

export const MessagesPanel = ({ currentUser }) => {
  const { activeConversation, setActiveConversation, showPanel, closePanel } = useMessages()
  const [inquiries, setInquiries] = useState([])
  const [groupChats, setGroupChats] = useState([])
  const [dms, setDms] = useState([])
  const [dialog, setDialog] = useState(null)

  const uid = currentUser?.uid
  const role = currentUser?.role

  useEffect(() => {
    if (!uid) return
    const field = role === 'owner' ? 'landlordUid' : 'tenantUid'
    const q = query(collection(db, 'inquiries'), where(field, '==', uid))
    return onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.lastMessageAt?.seconds || b.createdAt?.seconds || 0) - (a.lastMessageAt?.seconds || a.createdAt?.seconds || 0))
      setInquiries(list)
      setActiveConversation(prev => {
        if (!prev || prev.type !== 'inquiry') return prev
        const updated = list.find(i => i.id === prev.inquiry?.id)
        return updated ? { ...prev, inquiry: updated } : prev
      })
    })
  }, [uid, role, setActiveConversation])

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'propertyChats'), where('participantUids', 'array-contains', uid))
    return onSnapshot(q, snap => setGroupChats(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [uid])

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'directMessages'), where('participants', 'array-contains', uid))
    return onSnapshot(q, snap => setDms(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [uid])

  if (!showPanel) return null

  const allConvs = [
    ...inquiries.map(inq => ({
      key: `inq_${inq.id}`,
      type: 'inquiry',
      data: inq,
      title: inq.propertyTitle || 'Inquiry',
      subtitle: role === 'owner' ? inq.tenantName : 'Landlord',
      lastAt: inq.lastMessageAt?.seconds || inq.createdAt?.seconds || 0,
      unread: role === 'owner' ? !!inq.unreadByOwner : !!inq.unreadByTenant,
    })),
    ...groupChats.map(gc => ({
      key: `gc_${gc.id}`,
      type: 'group',
      data: gc,
      title: gc.propertyTitle || 'Group Chat',
      subtitle: 'Group Chat',
      lastAt: 0,
      unread: false,
    })),
    ...dms.map(dm => {
      const otherUid = (dm.participants || []).find(p => p !== uid) || ''
      const otherName = dm.participantNames?.[otherUid] || 'User'
      return {
        key: `dm_${dm.id}`,
        type: 'dm',
        data: { ...dm, otherUid, otherName },
        title: otherName,
        subtitle: 'Direct Message',
        lastAt: 0,
        unread: false,
      }
    }),
  ].sort((a, b) => b.lastAt - a.lastAt)

  const activeKey = !activeConversation ? null
    : activeConversation.type === 'inquiry' ? `inq_${activeConversation.inquiry?.id}`
    : activeConversation.type === 'group' ? `gc_${activeConversation.propertyId}`
    : `dm_${[uid, activeConversation.otherUser?.uid].sort().join('_')}`

  const selectConv = (conv) => {
    if (conv.type === 'inquiry') {
      setActiveConversation({ type: 'inquiry', inquiry: conv.data })
    } else if (conv.type === 'group') {
      setActiveConversation({ type: 'group', propertyId: conv.data.id, propertyTitle: conv.data.propertyTitle || '' })
    } else {
      setActiveConversation({ type: 'dm', otherUser: { uid: conv.data.otherUid, name: conv.data.otherName } })
    }
  }

  return (
    <>
      <div className='fixed inset-0 z-40 flex'>
        <div className='absolute inset-0 bg-black/30 backdrop-blur-[2px]' onClick={closePanel} />

        <div className='relative ml-auto flex flex-col bg-white shadow-2xl' style={{ width: 'min(100vw, 900px)', height: '100vh' }}>
          {/* Header */}
          <div className='flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 bg-white'>
            <div className='flex items-center gap-2.5'>
              <div className='w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center'>
                <i className='bi bi-chat-dots-fill text-white text-sm' />
              </div>
              <h2 className='font-bold text-slate-900 text-lg' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Messages</h2>
            </div>
            <button
              onClick={closePanel}
              className='w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all'
            >
              <i className='bi bi-x-lg text-sm' />
            </button>
          </div>

          {/* Body */}
          <div className='flex flex-1 min-h-0'>
            {/* Conversation list */}
            <div className='w-72 border-r border-slate-100 overflow-y-auto shrink-0 flex flex-col'>
              {allConvs.length === 0 ? (
                <div className='flex flex-col items-center justify-center flex-1 gap-4 px-6 py-16 text-center'>
                  <div className='w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center'>
                    <i className='bi bi-chat-square-dots text-indigo-300 text-3xl' />
                  </div>
                  <div>
                    <p className='text-sm font-semibold text-slate-700'>No conversations yet</p>
                    <p className='text-xs text-slate-400 mt-1.5 leading-relaxed'>
                      {role === 'owner'
                        ? 'Approve a tenant inquiry to start chatting with your tenants.'
                        : 'Send an inquiry to a property to start chatting with a landlord.'}
                    </p>
                  </div>
                </div>
              ) : allConvs.map(conv => (
                <button
                  key={conv.key}
                  onClick={() => selectConv(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors text-left ${
                    activeKey === conv.key
                      ? 'bg-indigo-50 border-l-[3px] border-l-indigo-500'
                      : 'border-l-[3px] border-l-transparent'
                  }`}
                >
                  {conv.type === 'group' ? (
                    <div className='w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shrink-0'>
                      <i className='bi bi-people-fill text-white text-sm' />
                    </div>
                  ) : (
                    <div className='w-9 h-9 rounded-full overflow-hidden bg-indigo-100 border border-indigo-200 shrink-0 flex items-center justify-center'>
                      <span className='text-sm font-bold text-indigo-600'>{(conv.title || '?').charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div className='flex-1 min-w-0'>
                    <p className={`text-sm truncate ${conv.unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                      {conv.title}
                    </p>
                    <p className='text-xs text-slate-400 truncate'>{conv.subtitle}</p>
                  </div>
                  {conv.unread && <span className='w-2.5 h-2.5 bg-indigo-500 rounded-full shrink-0' />}
                </button>
              ))}
            </div>

            {/* Chat view */}
            <div className='flex-1 flex flex-col min-w-0 min-h-0'>
              {!activeConversation ? (
                <div className='flex-1 flex flex-col items-center justify-center gap-3 text-slate-300'>
                  <i className='bi bi-chat-square-dots text-6xl' />
                  <p className='text-slate-400 text-sm'>Select a conversation to start chatting</p>
                </div>
              ) : activeConversation.type === 'inquiry' ? (
                <InquiryChatView
                  inquiry={activeConversation.inquiry}
                  currentUser={currentUser}
                  setDialog={setDialog}
                />
              ) : activeConversation.type === 'dm' ? (
                <DMChatView
                  currentUser={currentUser}
                  otherUser={activeConversation.otherUser}
                />
              ) : (
                <GroupChatView
                  currentUser={currentUser}
                  propertyId={activeConversation.propertyId}
                  propertyTitle={activeConversation.propertyTitle}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmModal dialog={dialog} onClose={() => setDialog(null)} />
    </>
  )
}
