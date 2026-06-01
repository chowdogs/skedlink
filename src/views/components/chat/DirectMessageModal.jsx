import React, { useState, useEffect, useRef } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../firebase'

const fmtTime = (ts) => {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const Avatar = ({ photo, name }) => (
  <div className='w-7 h-7 rounded-full overflow-hidden bg-indigo-100 border border-indigo-200 shrink-0 flex items-center justify-center'>
    {photo
      ? <img src={photo} alt='' className='w-full h-full object-cover' />
      : <span className='text-xs font-bold text-indigo-600'>{(name || '?').charAt(0).toUpperCase()}</span>
    }
  </div>
)

export const DirectMessageModal = ({ currentUser, otherUser, onClose }) => {
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
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [chatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (e) => {
    e.preventDefault()
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
    <div className='fixed inset-0 z-[55] flex items-center justify-center bg-black/50 px-4 py-6'>
      <div className='w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col' style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className='px-5 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0'>
          <Avatar photo={otherUser.profilePhoto} name={otherUser.name} />
          <div className='flex-1 min-w-0'>
            <h2 className='font-semibold text-slate-900 truncate'>{otherUser.name}</h2>
            <p className='text-xs text-slate-400'>Direct Message</p>
          </div>
          <button onClick={onClose} className='text-slate-400 hover:text-slate-700 text-2xl font-light leading-none'>×</button>
        </div>

        {/* Messages */}
        <div className='flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50'>
          {messages.length === 0 && (
            <p className='text-center text-sm text-slate-400 py-8'>No messages yet. Say hello!</p>
          )}
          {messages.map(msg => {
            const isMe = msg.senderUid === currentUser.uid
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && <Avatar photo={msg.senderPhoto} name={msg.senderName} />}
                <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl ${
                  isMe ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-100'
                }`}>
                  <p className='text-sm leading-relaxed'>{msg.text}</p>
                  <p className={`text-xs mt-1 ${isMe ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>
                    {fmtTime(msg.createdAt)}
                  </p>
                </div>
                {isMe && <Avatar photo={currentUser.profilePhoto} name={currentUser.fullName || currentUser.name} />}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={send} className='px-4 py-3 border-t border-slate-100 flex gap-2 shrink-0 bg-white'>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder='Type a message...'
            className='flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
          />
          <button
            type='submit'
            disabled={!text.trim() || sending}
            className='px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors'
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
