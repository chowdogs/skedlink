import React, { useState } from 'react'
import { termsFor, rentalRate, initialCharges, money } from '../../../lib/rentalTerms'
import { platform } from '../../../lib/platform'
import { Button } from '../../ui/Button'
export const ContactModal = ({ property, tenant, onSent, onClose }) => {
  const t=termsFor(property), [occupancy,setOccupancy]=useState(t.occupancy==='exclusive'?'exclusive':'shared')
  const [startDate,setStart]=useState(''),[endDate,setEnd]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const nights=Math.max(1,(Date.parse(endDate)-Date.parse(startDate))/86400000||1),periods=t.period==='day'?nights:t.period==='week'?Math.ceil(nights/7):1,items=initialCharges(property,occupancy,periods)
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await platform('apply',{propertyId:property.id,selection:{occupancy,startDate,endDate},message,type:'rent'});onSent({id:r.id,propertyId:property.id,propertyTitle:property.title,tenantUid:tenant.uid,landlordUid:property.ownerId,tenantName:tenant.fullName,tenantEmail:tenant.email,type:'rent',status:'pending'})}catch(e){setError(e.message);setBusy(false)}}
  const cls='w-full p-2 rounded-lg border border-slate-200'
  return <div className='fixed inset-0 z-50 bg-black/50 overflow-y-auto p-4 flex items-start justify-center'><form onSubmit={submit} className='my-8 bg-white rounded-2xl w-full max-w-lg p-6 space-y-4'>
    <div className='flex justify-between'><h2 className='text-xl font-bold'>Apply for {property.title}</h2><button type='button' onClick={onClose} aria-label='Close'>×</button></div>
    <label className='block text-sm'>Occupancy<select className={cls} value={occupancy} onChange={e=>setOccupancy(e.target.value)}>{t.occupancy!=='exclusive'&&<option value='shared'>Shared bed</option>}{t.occupancy!=='shared'&&<option value='exclusive'>Exclusive whole room</option>}</select></label>
    <p className='font-semibold text-indigo-700'>{money(rentalRate(property,occupancy))} / {t.period==='day'?'night':t.period}</p><p className='text-sm'>Minimum stay: {t.minimumStay} {t.minimumUnit}(s). Weekly stays round up to full weeks.</p>
    <div className='grid grid-cols-2 gap-3'><label className='text-sm'>Check-in<input className={cls} type='date' required value={startDate} onChange={e=>setStart(e.target.value)}/></label><label className='text-sm'>Check-out / contract end<input className={cls} type='date' required min={startDate} value={endDate} onChange={e=>setEnd(e.target.value)}/></label></div>
    <div className='bg-slate-50 p-3 rounded-xl text-sm space-y-1'>{items.map(i=><div key={i.id} className='flex justify-between'><span>{i.label}</span><span>{money(i.amount)}</span></div>)}<p className='border-t pt-2 font-bold'>Initial payment: {money(items.reduce((s,i)=>s+i.amount,0))}</p></div>
    <p className='text-xs text-slate-600'>Advance is reusable with landlord approval. Deposit is separate. Maintenance: {t.maintenanceCoverage.replaceAll('_',' ')}.</p>
    <div className='text-xs text-slate-600'>{Object.entries(t.utilities).map(([key,u])=><p key={key} className='capitalize'>{key}: {u.mode}{u.mode==='fixed'?` (${money(u.amount)} per tenant / period)`:''}</p>)}</div>
    {property.houseRules&&<p className='text-sm whitespace-pre-wrap p-3 border rounded-xl'>{property.houseRules}</p>}
    <label className='block text-sm'>Message<textarea className={cls} value={message} maxLength={2000} onChange={e=>setMessage(e.target.value)}/></label><p className='text-xs text-slate-500'>The landlord will send a contract. Tenancy activates only after the signed contract is accepted and payment is confirmed.</p>
    {error&&<p role='alert' className='text-sm text-rose-600'>{error}</p>}<Button disabled={busy} className='w-full'>{busy?'Submitting…':'Submit application'}</Button>
  </form></div>
}
