import React,{useState} from 'react'
import { platform } from '../../../lib/platform'
import { money, termsFor } from '../../../lib/rentalTerms'
import { Button } from '../../ui/Button'
export const PostBillModal=({properties,onClose,maintenanceRequest=null})=>{
  const [requestId]=useState(()=>crypto.randomUUID())
  const [propertyId,setProperty]=useState(maintenanceRequest?.propertyId||properties[0]?.id||''),[tenantUid,setTenant]=useState(maintenanceRequest?.tenantUid||'')
  const [type,setType]=useState(maintenanceRequest?'maintenance':'water'),[title,setTitle]=useState(maintenanceRequest?.title||''),[amount,setAmount]=useState(''),[reason,setReason]=useState('')
  const [month,setMonth]=useState(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}).slice(0,7)),[dueDate,setDue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const p=properties.find(p=>p.id===propertyId),tenants=Object.entries(p?.tenantDetails||{}),count=tenantUid?1:tenants.length
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{await platform('postBill',{requestId,propertyId,tenantUid,type,title,amount:Number(amount),reason,month,dueDate,maintenanceId:maintenanceRequest?.id||null});onClose()}catch(e){setError(e.message)}finally{setBusy(false)}}
  const cls='w-full border rounded-lg p-2 text-sm'
  return <div className='fixed inset-0 z-50 bg-black/50 overflow-y-auto p-4 flex justify-center items-start'><form onSubmit={submit} className='my-8 bg-white p-6 rounded-2xl w-full max-w-lg space-y-4'><h2 className='font-bold text-xl'>Post an itemized charge</h2>
    <label className='block text-sm'>Room<select className={cls} disabled={!!maintenanceRequest} value={propertyId} onChange={e=>{setProperty(e.target.value);setTenant('')}}>{properties.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    <label className='block text-sm'>Charge type<select className={cls} disabled={!!maintenanceRequest} value={type} onChange={e=>setType(e.target.value)}>{['rent','water','electricity','internet','maintenance','other'].map(t=><option key={t} value={t}>{t}</option>)}</select></label>
    <p className='text-xs text-slate-500'>Maintenance policy: {termsFor(p).maintenanceCoverage.replaceAll('_',' ')}. Included utilities cannot be charged again. Signed terms take precedence.</p>
    <label className='block text-sm'>Charge to<select className={cls} value={tenantUid} onChange={e=>setTenant(e.target.value)}><option value=''>Split equally among current tenants</option>{tenants.map(([uid,t])=><option key={uid} value={uid}>{t.name}</option>)}</select></label>
    <label className='block text-sm'>Description<input className={cls} required value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label className='block text-sm'>Tenant-chargeable amount (₱)<input className={cls} required type='number' min='0.01' step='0.01' value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    {count>0&&<p className='text-sm text-indigo-700'>Approximately {money(Number(amount)/count)} per tenant. Centavo differences are distributed fairly.</p>}
    <label className='block text-sm'>Reason / allocation {type==='maintenance'?'(required)':'(optional)'}<textarea className={cls} required={type==='maintenance'} value={reason} onChange={e=>setReason(e.target.value)} placeholder='Example: broken by tenant; repair ₱800, landlord covers ₱300, tenant pays ₱500.'/></label>
    <div className='grid grid-cols-2 gap-3'><label className='text-sm'>Billing month<input className={cls} type='month' required value={month} onChange={e=>setMonth(e.target.value)}/></label><label className='text-sm'>Due date<input className={cls} type='date' required value={dueDate} onChange={e=>setDue(e.target.value)}/></label></div>
    {error&&<p role='alert' className='text-sm text-rose-600'>{error}</p>}<div className='flex gap-3'><Button disabled={busy||!count}>{busy?'Posting…':'Post charge'}</Button><Button type='button' variant='secondary' onClick={onClose}>Cancel</Button></div>
  </form></div>
}
