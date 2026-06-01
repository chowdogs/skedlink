import React, { useState } from 'react'
import { addDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../firebase'
import { Input, Label } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { notify } from '../../../lib/notify'

export const ChoreModal = ({ properties, landlordUid, onClose }) => {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignMode, setAssignMode] = useState('auto')
  const [manualUid, setManualUid] = useState('')
  const [repeat, setRepeat] = useState('none')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedProp = properties.find(p => p.id === propertyId)
  const tenantEntries = selectedProp?.tenantDetails ? Object.entries(selectedProp.tenantDetails) : []

  const getAutoAssignee = async () => {
    if (tenantEntries.length === 0) return null
    const counts = {}
    for (const [uid] of tenantEntries) {
      const q = query(
        collection(db, 'chores'),
        where('propertyId', '==', propertyId),
        where('assignedTo', '==', uid)
      )
      const snap = await getDocs(q)
      counts[uid] = snap.size
    }
    let minUid = tenantEntries[0][0]
    let minCount = counts[minUid] ?? 0
    for (const [uid] of tenantEntries) {
      if ((counts[uid] ?? 0) < minCount) {
        minCount = counts[uid] ?? 0
        minUid = uid
      }
    }
    return minUid
  }

  const getWeekStart = (dateStr) => {
    const d = new Date(dateStr)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d.toISOString().slice(0, 10)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!propertyId) { setError('Select a property.'); return }
    if (tenantEntries.length === 0) { setError('This property has no approved tenants yet.'); return }
    setSaving(true)
    try {
      let uid = manualUid
      if (assignMode === 'auto') {
        uid = await getAutoAssignee()
        if (!uid) { setError('Could not auto-assign: no tenants.'); setSaving(false); return }
      }
      const tenantEntry = tenantEntries.find(([u]) => u === uid)
      const tenantName = tenantEntry?.[1]?.name || 'Tenant'
      await addDoc(collection(db, 'chores'), {
        propertyId,
        propertyTitle: selectedProp?.title || '',
        title,
        assignedTo: uid,
        assignedToName: tenantName,
        dueDate,
        status: 'pending',
        landlordUid,
        createdAt: serverTimestamp(),
        weekOf: dueDate ? getWeekStart(dueDate) : '',
        repeat,
      })
      await notify(uid, {
        type: 'chore',
        title: 'New Chore Assigned',
        body: `You've been assigned: "${title}" — due ${dueDate}.`,
        tab: 'myhome',
      })
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
            Create Chore
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
                onChange={e => { setPropertyId(e.target.value); setManualUid('') }}
                className='w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
              >
                {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label>Chore Description</Label>
            <Input placeholder='e.g. Clean bathroom, Take out trash, Mop floors' value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type='date' value={dueDate} onChange={e => setDueDate(e.target.value)} required />
          </div>
          <div>
            <Label>Recurrence</Label>
            <div className='flex gap-2 mt-1'>
              {[['none', 'One-time'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([val, label]) => (
                <button key={val} type='button' onClick={() => setRepeat(val)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                    repeat === val ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Assignment</Label>
            <div className='flex gap-2 mt-1'>
              {[['auto', 'Auto-Assign'], ['manual', 'Pick Tenant']].map(([val, label]) => (
                <button
                  key={val} type='button'
                  onClick={() => setAssignMode(val)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    assignMode === val
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {assignMode === 'auto' && (
              <p className='text-xs text-slate-500 mt-1.5 flex items-center gap-1'>
                <i className='bi bi-magic' /> Assigns to the tenant with the fewest chores.
              </p>
            )}
            {assignMode === 'manual' && (
              <select
                value={manualUid}
                onChange={e => setManualUid(e.target.value)}
                required
                className='w-full mt-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
              >
                <option value=''>Select tenant...</option>
                {tenantEntries.map(([uid, t]) => (
                  <option key={uid} value={uid}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
          {error && <p className='text-sm text-rose-600'>{error}</p>}
          <div className='flex gap-3 pt-1'>
            <Button type='button' variant='secondary' className='flex-1' onClick={onClose}>Cancel</Button>
            <Button type='submit' variant='primary' className='flex-1' disabled={saving}>
              {saving ? 'Creating...' : 'Create Chore'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
