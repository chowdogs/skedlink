import React, { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../../firebase'
import { checkout, platform, refreshCheckout } from '../../../lib/platform'
import { money, formatDate } from '../../../lib/rentalTerms'
import { Button } from '../../ui/Button'

export function useRecords(name, field, uid) {
  const [records, setRecords] = useState([]), [error, setError] = useState('')
  useEffect(() => {
    if (!uid) return
    return onSnapshot(query(collection(db, name), where(field, '==', uid)), s => { setRecords(s.docs.map(d => ({ id: d.id, ...d.data() }))); setError('') }, e => setError(e.message))
  }, [name, field, uid])
  return [records, error]
}
export const PaymentsPanel = ({ user, landlord = false }) => {
  const field = landlord ? 'landlordUid' : 'tenantUid'
  const [bills, error] = useRecords('bills', field, user.uid)
  const [payments] = useRecords('payments', field, user.uid)
  const [accounts] = useRecords('tenantAccounts', field, user.uid)
  const [requests] = useRecords('advanceRequests', field, user.uid)
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('')
  const [month, setMonth] = useState(''), [tenant, setTenant] = useState('')
  const [advance, setAdvance] = useState({}), [orders] = useRecords('checkoutOrders', 'uid', user.uid)
  const run = async fn => { setBusy(true); setMsg(''); try { const value = await fn(); setMsg(value?.status ? `Payment status: ${value.status}` : 'Saved successfully.'); } catch (e) { setMsg(e.message) } finally { setBusy(false) } }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('checkout')
    if (id) { refreshCheckout(id).then(r => setMsg(`Payment status: ${r.status}`)).catch(e => setMsg(e.message)); window.history.replaceState({}, '', window.location.pathname) }
  }, [])
  const visible = bills.filter(b => b.schemaVersion === 2 && b.status !== 'cancelled' && (!month || b.month === month) && (!tenant || b.tenantUid === tenant)).sort((a,b) => (b.dueDate || '').localeCompare(a.dueDate || ''))
  const paid = b => Number(b.paidAmount || 0)
  const remaining = b => Math.max(0, Number(b.totalAmount) - paid(b))
  return <section className='payment-statement space-y-5 print:bg-white'>
    <div className='flex flex-wrap justify-between items-center gap-3'><div><h2 className='text-xl font-bold'>Payments & statements</h2><p className='text-sm text-slate-500'>Itemized charges, confirmed receipts, and reusable advance balances.</p></div><div className='flex gap-2 print:hidden'>{landlord && <Button disabled={busy} onClick={() => run(() => platform('generateRent'))}>Generate due rent</Button>}<Button variant='secondary' onClick={() => window.print()}>Print / Save PDF</Button></div></div>
    {(error || msg) && <p role='status' className='p-3 bg-indigo-50 rounded-xl text-sm'>{error || msg}</p>}
    <div className='grid md:grid-cols-3 gap-3'>{accounts.map(a => <div key={a.id} className='p-4 rounded-xl border bg-white'><p className='text-sm font-semibold'>{landlord ? 'Tenant balances' : 'My balances'}</p><p>Advance: {money(a.advanceBalance)}</p><p className='text-sm text-slate-500'>Reserved: {money(a.reservedAdvance)} · Deposit: {money(a.depositBalance)}</p></div>)}</div>
    {requests.filter(r => r.status === 'pending').map(r => <div key={r.id} className='p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap gap-3 items-center'><p className='flex-1 text-sm'>Advance requested: {money(r.amount)} · {bills.find(b => b.id === r.billId)?.title || 'Rent'} · {formatDate(r.createdAt)}</p>{landlord ? <><Button disabled={busy} onClick={() => run(() => platform('reviewAdvance', { id:r.id, approve:true }))}>Approve credit</Button><Button variant='secondary' disabled={busy} onClick={() => run(() => platform('reviewAdvance', { id:r.id, approve:false }))}>Decline</Button></> : <span className='text-sm'>Awaiting landlord review</span>}</div>)}
    <div className='flex gap-3 print:hidden'><label className='text-sm'>Billing month<input type='month' className='block border rounded-lg p-2' value={month} onChange={e => setMonth(e.target.value)} /></label>{landlord && <label className='text-sm'>Tenant<select className='block border rounded-lg p-2' value={tenant} onChange={e => setTenant(e.target.value)}><option value=''>All tenants</option>{[...new Set(bills.map(b => b.tenantUid))].filter(Boolean).map(uid => <option key={uid} value={uid}>{payments.find(p => p.tenantUid === uid)?.tenantName || bills.find(b => b.tenantUid === uid)?.tenantName || `Tenant ${uid.slice(0,6)}`}</option>)}</select></label>}<button onClick={() => { setMonth(''); setTenant('') }} className='text-sm text-indigo-600'>Clear filters</button></div>
    <div className='p-4 bg-indigo-600 text-white rounded-xl'><span>Total charges: {money(visible.reduce((s,b) => s + Number(b.totalAmount),0))}</span><span className='ml-5'>Paid/credited: {money(visible.reduce((s,b) => s + paid(b),0))}</span><strong className='block mt-1'>Balance due: {money(visible.reduce((s,b) => s + remaining(b),0))}</strong></div>
    {!visible.length && <p className='p-5 text-slate-500 bg-white border rounded-xl'>No itemized bills for this selection. Move-in bills appear after the signed contract is accepted.</p>}
    {visible.map(b => {
      const receipt = payments.filter(p => p.billId === b.id && p.status === 'paid')
      const account = accounts.find(a => a.propertyId === b.propertyId && a.tenantUid === b.tenantUid)
      return <article key={b.id} className='p-5 bg-white border rounded-2xl break-inside-avoid'>
        <div className='flex justify-between gap-3'><div><h3 className={`font-semibold ${remaining(b) === 0 ? 'line-through text-slate-500' : ''}`}>{b.title}</h3><p className='text-xs text-slate-500'>{b.propertyTitle} · Due {b.dueDate}</p></div><strong>{remaining(b) === 0 ? 'PAID' : b.checkoutPending ? 'Payment pending' : 'Unpaid'}</strong></div>
        {b.reason && <p className='text-sm my-2 bg-amber-50 p-2 rounded'>Charge explanation: {b.reason}</p>}
        {(b.lineItems || [{id:b.id,label:b.title,amount:b.totalAmount}]).map(l => <div key={l.id} className='flex justify-between text-sm py-1'><span>{l.label}</span><span>{money(l.amount)}</span></div>)}
        <div className='flex justify-between border-t pt-2 text-sm'><span>Remaining balance</span><strong>{money(remaining(b))}</strong></div>
        {receipt.map(p => <div key={p.id} className='mt-3 rounded-lg bg-emerald-50 p-3 text-xs'><strong>Payment receipt · {money(p.amount)}</strong><p>{p.method === 'advance' ? 'Advance credit applied' : 'PayMongo test payment'} · {formatDate(p.reviewedAt)}</p><p className='break-all'>Reference: {p.referenceNo}</p></div>)}
        {!landlord && remaining(b) > 0 && <div className='flex flex-wrap gap-2 mt-3 print:hidden'>
          {!b.checkoutPending && <Button disabled={busy || b.advancePending} onClick={() => run(() => checkout({billId:b.id}))}>Pay {money(remaining(b))}</Button>}
          {b.checkoutPending && <><Button disabled={busy} onClick={() => run(async () => { const r = await refreshCheckout(b.checkoutPending); if(r.url) window.location.assign(r.url); return r })}>Continue / check payment</Button><Button variant='secondary' disabled={busy} onClick={() => run(() => refreshCheckout(b.checkoutPending,true))}>Cancel pending checkout</Button></>}
          {b.type === 'rent' && account && !b.checkoutPending && !b.advancePending && account.advanceBalance > (account.reservedAdvance || 0) && <><input className='border rounded-lg p-2 w-32 text-sm' aria-label='Advance amount' type='number' min='0.01' step='0.01' max={Math.min(remaining(b), account.advanceBalance - (account.reservedAdvance || 0))} value={advance[b.id] ?? Math.min(remaining(b), account.advanceBalance - (account.reservedAdvance || 0))} onChange={e => setAdvance({...advance,[b.id]:e.target.value})}/><Button variant='secondary' disabled={busy} onClick={() => run(() => platform('requestAdvance',{billId:b.id,amount:Number(advance[b.id] ?? Math.min(remaining(b),account.advanceBalance - (account.reservedAdvance || 0)))}))}>Use advance</Button></>}
        </div>}
      </article>
    })}
    {orders.some(o => o.kind === 'subscription') && <div className='space-y-2'><h3 className='font-semibold'>Subscription payment history</h3>{orders.filter(o => o.kind === 'subscription').map(o => <div key={o.id} className='border rounded-xl p-3 text-sm'>{money(o.amount)} · {o.limit} listings · {o.status}{o.status === 'pending' && <Button variant='secondary' disabled={busy} onClick={() => run(() => refreshCheckout(o.id))}>Check payment</Button>}</div>)}</div>}
    {requests.some(r => r.status !== 'pending') && <details><summary className='cursor-pointer font-semibold'>Advance request history</summary>{requests.filter(r => r.status !== 'pending').map(r => <p key={r.id} className='p-2 text-sm'>{money(r.amount)} · {r.status} · {formatDate(r.reviewedAt)}</p>)}</details>}
  </section>
}
