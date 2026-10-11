import React, { useState } from 'react'
import { PLANS, money, listingLimit, formatDate } from '../../../lib/rentalTerms'
import { checkout, platform } from '../../../lib/platform'
import { useRecords } from './PaymentsPanel'
import { Button } from '../../ui/Button'

export const SubscriptionPanel = ({ user, properties }) => {
  const [subscriptions] = useRecords('subscriptions','landlordUid',user.uid)
  const [requests] = useRecords('customPlanRequests','landlordUid',user.uid)
  const [busy,setBusy] = useState(false),[msg,setMsg] = useState(''),[count,setCount] = useState(12),[note,setNote] = useState('')
  const sub = subscriptions[0],limit = listingLimit(sub)
  const run = async fn => {setBusy(true);setMsg('');try{await fn();setMsg('Request recorded. Custom pricing will need to be arranged before activation.')}catch(e){setMsg(e.message)}finally{setBusy(false)}}
  return <section className='space-y-5'><div><h2 className='text-xl font-bold'>Landlord plans</h2><p className='text-slate-500 text-sm'>One listing = one rentable room. Seekers use SkedLink for free.</p></div>
    <div className='p-4 rounded-xl bg-indigo-50'><p className='font-semibold'>{properties.length} / {limit} listings used</p>{sub?.expiresAt && <p className='text-sm'>Paid access ends: {formatDate(sub.expiresAt)}</p>}<p className='text-xs mt-2'>Existing tenant access and payment records remain available after expiry. Renewals are manual every 30 days.</p></div>
    {msg && <p role='status' className='text-sm p-3 bg-amber-50 rounded-xl'>{msg}</p>}
    <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4'>{PLANS.map(p => <article key={p.limit} className={`bg-white border rounded-2xl p-5 ${limit===p.limit?'border-indigo-500':'border-slate-200'}`}><h3 className='font-semibold'>{p.label}</h3><p className='text-2xl font-bold my-2'>{money(p.amount)}<span className='text-xs text-slate-500'> / month</span></p><p className='text-sm'>Up to {p.limit} room listing{p.limit===1?'':'s'}</p><p className='text-sm text-slate-500 mt-2'>{p.limit===1?'Core applications, contracts, billing and household tools.':'Core tools + multi-room management, revenue analytics and report export.'}</p>{p.limit>1 ? <Button className='mt-4 w-full' disabled={busy || properties.length>p.limit || limit>p.limit} onClick={()=>run(()=>checkout({limit:p.limit}))}>{limit===p.limit?'Renew plan':'Choose plan'}</Button> : <p className='mt-4 text-sm font-semibold'>Always available · no trial required</p>}</article>)}</div>
    {limit > 1 && <p className='text-xs text-slate-500'>Renewals extend your current term by 30 days. Upgrades start a new 30-day term at the displayed full price, without prorated credit. Downgrade after expiry.</p>}
    <form onSubmit={e=>{e.preventDefault();run(()=>platform('customPlan',{listings:Number(count),note}))}} className='p-5 bg-white border rounded-2xl space-y-3'><h3 className='font-semibold'>More than 10 rooms? Request custom billing</h3><label className='block text-sm'>Number of listings<input type='number' min='11' max='10000' required className='block p-2 rounded-lg border w-full' value={count} onChange={e=>setCount(e.target.value)}/></label><label className='block text-sm'>Requirements<textarea className='block p-2 rounded-lg border w-full' value={note} onChange={e=>setNote(e.target.value)} /></label><Button disabled={busy}>Submit request</Button>{requests[0] && <p className='text-sm'>Request status: {requests[0].status} · {requests[0].listings} listings</p>}</form>
  </section>
}
