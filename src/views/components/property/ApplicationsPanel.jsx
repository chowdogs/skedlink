import React, { useState } from 'react'
import { uploadContract, downloadContract, platform } from '../../../lib/platform'
import { money, formatDate } from '../../../lib/rentalTerms'
import { Button } from '../../ui/Button'
import agreementPdf from '../../../contract/sched link contract.pdf'

export const ApplicationsPanel = ({ inquiries, user, landlord = false }) => {
  const [busy,setBusy] = useState(false), [msg,setMsg] = useState('')
  const run = async fn => { setBusy(true);setMsg(''); try { await fn();setMsg('Saved successfully.') } catch(e){setMsg(e.message)} finally{setBusy(false)} }
  const upload = (i,file) => run(async () => {
    const document = await uploadContract(file,`contracts/${i.id}/${user.uid}/${Date.now()}.pdf`)
    await platform(landlord ? 'sendContract' : 'submitContract',{id:i.id,file:document})
  })
  return <section className='space-y-4'><div><h2 className='text-xl font-bold'>Applications & contracts</h2><p className='text-sm text-slate-500'>Application → signed contract → confirmed payment → active tenancy. Contract reservations last 48 hours.</p>{landlord && <a className='inline-block mt-2 text-sm font-semibold text-indigo-700 underline' href={agreementPdf} download='sched-link-contract.pdf' type='application/pdf'>Download agreement PDF</a>}</div>
    {msg && <p role='status' className='bg-indigo-50 p-3 rounded-xl text-sm'>{msg}</p>}
    {!inquiries.length && <p className='p-5 border rounded-xl bg-white text-slate-500'>No applications yet.</p>}
    {inquiries.map(i => <article key={i.id} className='p-5 border rounded-2xl bg-white space-y-3'>
      <div className='flex justify-between gap-3'><div><h3 className='font-semibold'>{i.propertyTitle}</h3>{landlord && <p className='text-sm'>{i.tenantName}</p>}</div><span className='text-xs bg-indigo-50 text-indigo-700 p-2 rounded-lg self-start'>{i.status.replaceAll('_',' ')}</span></div>
      {i.selection ? <><p className='text-sm'>{i.selection.occupancy === 'exclusive' ? 'Exclusive whole room' : 'Shared bed'} · {money(i.selection.rate)} / {i.selection.period} · {i.selection.startDate} to {i.selection.endDate}</p><div className='text-sm bg-slate-50 p-3 rounded-xl'>{i.selection.lineItems.map(l => <div key={l.id} className='flex justify-between'><span>{l.label}</span><span>{money(l.amount)}</span></div>)}<p className='font-bold border-t mt-2 pt-2'>Initial payment: {money(i.selection.total)}</p><p className='mt-2'>Maintenance: {i.selection.terms.maintenanceCoverage.replaceAll('_',' ')}</p>{Object.entries(i.selection.terms.utilities || {}).map(([name,u]) => <p key={name} className='capitalize'>{name}: {u.mode}{u.mode === 'fixed' ? ` (${money(u.amount)} / period)` : ''}</p>)}{i.selection.houseRules && <p className='mt-2 whitespace-pre-wrap'>House rules: {i.selection.houseRules}</p>}</div></> : <p className='text-sm text-amber-700'>Legacy application: submit a new application with rental dates and terms before using the contract/payment flow.</p>}
      {i.reservationExpiresAt && i.status !== 'approved' && <p className='text-xs text-slate-500'>Reservation expires: {formatDate(i.reservationExpiresAt)}</p>}
      <div className='flex gap-2 flex-wrap'>
        {i.contract && <Button variant='secondary' disabled={busy} onClick={() => run(() => downloadContract(i.contract))}>Download landlord contract</Button>}
        {i.signedContract && <Button variant='secondary' disabled={busy} onClick={() => run(() => downloadContract(i.signedContract))}>Download signed copy</Button>}
        {landlord && i.type === 'rent' && i.selection && ['pending','active','contract_sent','contract_submitted'].includes(i.status) && <label className='text-sm px-4 py-2 rounded-xl bg-indigo-600 text-white cursor-pointer'>{i.contract ? 'Send revised contract' : 'Upload & send contract'}<input className='sr-only' type='file' accept='application/pdf' disabled={busy} onChange={e => { if(e.target.files[0]) upload(i,e.target.files[0]);e.target.value='' }} /></label>}
        {!landlord && i.status === 'contract_sent' && <label className='text-sm px-4 py-2 rounded-xl bg-indigo-600 text-white cursor-pointer'>Upload signed contract<input className='sr-only' type='file' accept='application/pdf' disabled={busy} onChange={e => { if(e.target.files[0]) upload(i,e.target.files[0]);e.target.value='' }} /></label>}
        {landlord && i.status === 'contract_submitted' && <Button disabled={busy} onClick={() => run(() => platform('acceptContract',{id:i.id}))}>Accept contract & request payment</Button>}
        {!['approved','closed','cancelled','rejected'].includes(i.status) && <Button variant='secondary' disabled={busy} onClick={() => run(() => platform('cancelApplication',{id:i.id}))}>Cancel application</Button>}
      </div>
      {i.status === 'awaiting_payment' && <p className='text-sm text-indigo-700'>Contract accepted. {landlord ? 'Waiting for confirmed payment before activation.' : 'Open Payments to complete your move-in payment.'}</p>}
    </article>)}
  </section>
}
