import React, { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../firebase'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card'
import { Button } from '../../ui/Button'

export const ContactModal = ({ property, tenant, onSent, onClose }) => {
  const [type, setType] = useState('rent')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    setSending(true)
    setError('')
    try {
      const inquiryData = {
        propertyId: property.id,
        propertyTitle: property.title,
        landlordUid: property.ownerId,
        tenantUid: tenant.uid,
        tenantName: tenant.fullName || tenant.name,
        tenantEmail: tenant.email,
        tenantPhone: tenant.phone || '',
        type,
        message: message.trim(),
        status: 'pending',
        unreadByOwner: true,
        unreadByTenant: false,
        createdAt: serverTimestamp()
      }
      const docRef = await addDoc(collection(db, 'inquiries'), inquiryData)
      onSent({ id: docRef.id, ...inquiryData })
    } catch (err) {
      setError('Failed to send: ' + err.message)
      setSending(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4'>
      <div className='w-full max-w-md'>
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle>Contact Landlord</CardTitle>
              <button
                type='button'
                onClick={onClose}
                className='text-slate-400 hover:text-slate-700 text-2xl font-light'
              >
                ×
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <div className='p-3 bg-slate-50 rounded-lg'>
                <p className='text-sm font-medium text-slate-900'>{property.title}</p>
                <p className='text-xs text-slate-500'>{property.location?.address || ''}</p>
                <p className='text-sm text-indigo-600 font-medium mt-1'>₱{Number(property.price).toLocaleString()}/mo</p>
              </div>

              <div>
                <p className='text-sm font-medium text-slate-700 mb-2'>I want to:</p>
                <div className='flex gap-2'>
                  {[
                    { val: 'rent', label: 'Rent this property' },
                    { val: 'visit', label: 'Schedule a visit' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type='button'
                      onClick={() => setType(opt.val)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                        type === opt.val
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className='text-sm font-medium text-slate-700 block mb-1'>
                  Message <span className='text-slate-400 font-normal'>(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder='Introduce yourself or ask a question...'
                  className='w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none'
                />
              </div>

              {error && (
                <p className='text-sm text-red-600 bg-red-50 p-2 rounded-lg'>{error}</p>
              )}

              <div className='flex gap-3'>
                <Button onClick={handleSend} variant='primary' disabled={sending} className='flex-1'>
                  {sending ? 'Sending...' : 'Send & Open Chat'}
                </Button>
                <Button onClick={onClose} variant='secondary'>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
