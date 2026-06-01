import React, { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../firebase'
import { Input, Label } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { notify, monthLastDay, currentMonth } from '../../../lib/notify'

export const PostBillModal = ({ properties, landlordUid, onClose }) => {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [dueDate, setDueDate] = useState(monthLastDay(currentMonth()))
  const [isRevenue, setIsRevenue] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedProp = properties.find(p => p.id === propertyId)
  const tenantEntries = selectedProp?.tenantDetails ? Object.entries(selectedProp.tenantDetails) : []
  const tenantCount = tenantEntries.length || 1
  const perTenant = totalAmount ? Math.round((Number(totalAmount) / tenantCount) * 100) / 100 : 0

  const handleMonthChange = (m) => {
    setMonth(m)
    setDueDate(monthLastDay(m))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!propertyId) { setError('Select a property.'); return }
    setSaving(true)
    try {
      await addDoc(collection(db, 'bills'), {
        propertyId,
        propertyTitle: selectedProp?.title || '',
        title,
        totalAmount: Number(totalAmount),
        perTenantAmount: perTenant,
        splitCount: tenantCount,
        type: 'utility',
        isRevenue,
        month,
        dueDate,
        landlordUid,
        createdAt: serverTimestamp(),
      })

      // Notify each tenant
      for (const [uid] of tenantEntries) {
        await notify(uid, {
          type: 'bill',
          title: `New Bill: ${title}`,
          body: `₱${perTenant.toLocaleString()} due by ${dueDate} for ${selectedProp?.title}.`,
          tab: 'myhome',
        })
      }
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <div className='bg-white rounded-2xl shadow-2xl w-full max-w-sm'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-slate-100'>
          <h2 className='font-bold text-slate-900 text-lg' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Post a Bill
          </h2>
          <button onClick={onClose} className='text-slate-400 hover:text-slate-700 transition-colors'>
            <i className='bi bi-x-lg text-sm' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          {properties.length > 1 && (
            <div>
              <Label>Property</Label>
              <select
                value={propertyId}
                onChange={e => setPropertyId(e.target.value)}
                className='w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white focus:border-indigo-400'
              >
                {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label>Bill Title</Label>
            <Input placeholder='Electricity, Water, Internet...' value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label>Total Amount (₱)</Label>
            <Input type='number' min='0' step='0.01' placeholder='2000' value={totalAmount} onChange={e => setTotalAmount(e.target.value)} required />
          </div>

          {/* Split preview */}
          {totalAmount && Number(totalAmount) > 0 && (
            <div className='p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl'>
              <div className='flex items-center justify-between'>
                <p className='text-xs text-indigo-700 font-semibold'>Split equally among {tenantCount} tenant{tenantCount !== 1 ? 's' : ''}</p>
                <p className='text-sm font-bold text-indigo-700'>₱{perTenant.toLocaleString()} / tenant</p>
              </div>
              {tenantCount === 0 && (
                <p className='text-xs text-amber-600 mt-1'>No approved tenants yet — bill will be shown once tenants are added.</p>
              )}
            </div>
          )}

          <div>
            <Label>Billing Month</Label>
            <Input type='month' value={month} onChange={e => handleMonthChange(e.target.value)} required />
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type='date' value={dueDate} onChange={e => setDueDate(e.target.value)} required />
          </div>
          <div>
            <Label>Count as Revenue?</Label>
            <p className='text-xs text-slate-400 mb-2'>Enable only if you earn from this bill (e.g. security deposit, fees). Turn off for pass-through bills like electricity or water.</p>
            <button
              type='button'
              onClick={() => setIsRevenue(v => !v)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all w-full ${
                isRevenue
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${isRevenue ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isRevenue ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </span>
              <span className='text-sm font-semibold'>
                {isRevenue ? 'Yes — count in revenue analytics' : 'No — pass-through only (e.g. electricity)'}
              </span>
            </button>
          </div>
          {error && <p className='text-sm text-rose-600'>{error}</p>}
          <div className='flex gap-3 pt-1'>
            <Button type='button' variant='secondary' className='flex-1' onClick={onClose}>Cancel</Button>
            <Button type='submit' variant='primary' className='flex-1' disabled={saving}>
              {saving ? 'Posting...' : 'Post Bill'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
