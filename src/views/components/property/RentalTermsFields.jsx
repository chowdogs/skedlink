import React from 'react'
import { DEFAULT_TERMS, money } from '../../../lib/rentalTerms'

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white'
export const RentalTermsFields = ({ value, onChange, price, capacity }) => {
  const t = { ...DEFAULT_TERMS, ...value, utilities: { ...DEFAULT_TERMS.utilities, ...value?.utilities } }
  const set = (key, val) => onChange({ ...t, [key]: val })
  return <fieldset className='space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4'>
    <legend className='font-semibold px-2'>Rental and payment terms</legend>
    <p className='text-xs text-slate-600'>One listing represents one room. The price above is the whole-room rate per selected billing period.</p>
    <div className='grid md:grid-cols-2 gap-3'>
      <label className='text-sm'>Occupancy<select className={input} value={t.occupancy} onChange={e => set('occupancy', e.target.value)}><option value='shared'>Shared beds only</option><option value='exclusive'>Whole room only</option><option value='both'>Shared or whole room</option></select></label>
      <label className='text-sm'>Billing period<select className={input} value={t.period} onChange={e => set('period', e.target.value)}><option value='day'>Per night</option><option value='week'>Per week</option><option value='month'>Per month</option></select></label>
      <label className='text-sm'>Minimum stay<input className={input} type='number' min='1' max='365' step='1' required value={t.minimumStay} onChange={e => set('minimumStay', Number(e.target.value))} /></label>
      <label className='text-sm'>Minimum stay unit<select className={input} value={t.minimumUnit} onChange={e => set('minimumUnit', e.target.value)}><option value='day'>Nights</option><option value='week'>Weeks</option><option value='month'>Months</option></select></label>
    </div>
    <p className='text-sm text-indigo-700'>Whole room: {money(price)} · Shared bed: {money(Number(price) / Math.max(1, Number(capacity) || 1))} / {t.period}</p>
    <div className='grid md:grid-cols-2 gap-3'>{[['advancePeriods', 'Reusable advance'], ['depositPeriods', 'Security deposit']].map(([key, label]) => <div key={key}>
      <label className='text-sm flex gap-2 items-center'><input type='checkbox' checked={Number(t[key]) > 0} onChange={e => set(key, e.target.checked ? 1 : 0)} />{label}</label>
      {Number(t[key]) > 0 && <label className='text-xs'>Number of rental periods<input className={input} type='number' min='1' max='24' step='1' value={t[key]} onChange={e => set(key, Number(e.target.value))} required /></label>}
    </div>)}</div>
    <p className='text-xs text-slate-500'>Advance is an extra reusable balance, separate from the first rent and security deposit. Its use requires landlord approval.</p>
    <label className='block text-sm'>Maintenance responsibility<select className={input} value={t.maintenanceCoverage} onChange={e => set('maintenanceCoverage', e.target.value)}><option value='landlord'>Landlord covers maintenance</option><option value='tenant'>Tenant covers maintenance</option><option value='case_by_case'>Depends on cause; costs may be shared</option></select></label>
    <div className='space-y-2'>{Object.entries(t.utilities).map(([key, u]) => <div key={key} className='grid grid-cols-3 gap-2 items-center'>
      <label className='capitalize text-sm' htmlFor={`utility-${key}`}>{key}</label><select id={`utility-${key}`} className={input} value={u.mode} onChange={e => set('utilities', { ...t.utilities, [key]: { ...u, mode: e.target.value } })}><option value='included'>Included</option><option value='fixed'>Separate fixed</option><option value='variable'>Separate variable</option></select>
      {u.mode === 'fixed' ? <input aria-label={`${key} amount per tenant per billing period`} className={input} type='number' min='0.01' step='0.01' required value={u.amount} onChange={e => set('utilities', { ...t.utilities, [key]: { ...u, amount: Number(e.target.value) } })} /> : <span className='text-xs text-slate-500'>{u.mode === 'included' ? 'No extra charge' : 'Itemized each period'}</span>}
    </div>)}</div>
  </fieldset>
}
