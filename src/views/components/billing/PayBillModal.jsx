import React, { useState } from 'react'
import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../../firebase'
import { Input, Label } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { compressToBase64 } from '../../../lib/compressToBase64'
import { notify } from '../../../lib/notify'

export const PayBillModal = ({ bill, tenant, landlordUid, existingPayment, onClose }) => {
  const [referenceNo, setReferenceNo] = useState(existingPayment?.referenceNo || '')
  const [receiptImage, setReceiptImage] = useState(existingPayment?.receiptImageBase64 || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const displayAmount = bill.perTenantAmount ?? bill.amount ?? bill.totalAmount ?? 0
  const tenantName = tenant.fullName || tenant.name || 'Tenant'

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const b64 = await compressToBase64(file, { maxPx: 1200, quality: 0.82 })
      setReceiptImage(b64)
    } catch (err) {
      setError('Image failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (existingPayment) {
        await updateDoc(doc(db, 'payments', existingPayment.id), {
          referenceNo,
          receiptImageBase64: receiptImage,
          status: 'under_review',
          amount: displayAmount,
          submittedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'payments'), {
          billId: bill.id,
          propertyId: bill.propertyId,
          landlordUid,
          tenantUid: tenant.uid,
          tenantName,
          amount: displayAmount,
          referenceNo,
          receiptImageBase64: receiptImage,
          status: 'under_review',
          submittedAt: serverTimestamp(),
        })
      }
      await notify(landlordUid, {
        type: 'payment',
        title: 'Payment Submitted',
        body: `${tenantName} submitted ₱${Number(displayAmount).toLocaleString()} for "${bill.title}". Review it in the Bills tab.`,
        tab: 'bills',
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
          <div>
            <h2 className='font-bold text-slate-900 text-lg' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Submit Payment
            </h2>
            <p className='text-sm text-slate-500'>{bill.title} — ₱{Number(displayAmount).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className='text-slate-400 hover:text-slate-700 transition-colors'>
            <i className='bi bi-x-lg text-sm' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <div className='p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl'>
            <p className='text-xs font-semibold text-indigo-700 mb-0.5'>Payment via GCash</p>
            <p className='text-xs text-slate-600'>
              Send <span className='font-bold'>₱{Number(displayAmount).toLocaleString()}</span> to your landlord then paste your GCash reference number below.
            </p>
          </div>
          <div>
            <Label>GCash Reference Number</Label>
            <Input placeholder='e.g. 1234567890' value={referenceNo} onChange={e => setReferenceNo(e.target.value)} required />
          </div>
          <div>
            <Label>Receipt Screenshot (optional)</Label>
            {receiptImage && (
              <img src={receiptImage} alt='Receipt' className='w-full rounded-xl mb-2 max-h-40 object-contain border border-slate-200' />
            )}
            <label className='cursor-pointer block'>
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                uploading
                  ? 'text-slate-400 border-slate-200 bg-slate-50 cursor-not-allowed'
                  : 'text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100'
              }`}>
                <i className='bi bi-image' />
                {uploading ? 'Uploading...' : receiptImage ? 'Replace Screenshot' : 'Upload Screenshot'}
              </span>
              <input type='file' accept='image/*' className='hidden' onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>
          {error && <p className='text-sm text-rose-600'>{error}</p>}
          <div className='flex gap-3 pt-1'>
            <Button type='button' variant='secondary' className='flex-1' onClick={onClose}>Cancel</Button>
            <Button type='submit' variant='primary' className='flex-1' disabled={saving || uploading}>
              {saving ? 'Submitting...' : 'Submit Payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
