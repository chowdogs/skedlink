import React, { useEffect } from 'react'
import { TERMS_VERSION } from '../../lib/terms'

const sections = [
  {
    title: 'Accounts and respectful use',
    body: 'Provide accurate account information, choose the correct Tenant or Landlord role, and keep your sign-in details private. Do not impersonate others, post misleading information, or use SkedLink to harass or defraud anyone.',
  },
  {
    title: 'Listings, matching, and applications',
    body: 'Landlords are responsible for the accuracy of their listings, permissions, and offered rental terms. Tenants should review a listing and ask questions before applying. Schedule compatibility scores are estimates and do not guarantee a suitable housemate or room.',
  },
  {
    title: 'Rental agreements and charges',
    body: 'Review the dates, occupancy, rent, utilities, advance, deposit, and other charges before signing a rental agreement. A signed agreement between the landlord and tenant governs their rental arrangement; creating a SkedLink account does not create a tenancy.',
  },
  {
    title: 'Test payments',
    body: 'The current PayMongo checkout runs in test mode. It records a demonstration transaction only. SkedLink does not currently provide real fund transfers, automatic landlord payouts, escrow, or automatic refunds.',
  },
  {
    title: 'Personal information and documents',
    body: 'SkedLink uses the account details, contact information, schedules, and documents you provide to operate matching, applications, contracts, billing, and notifications. Contract files are available to the landlord and tenant involved in the application. Only upload information you are authorized to share.',
  },
]

export const TermsModal = ({ onClose }) => {
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className='fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4' onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div role='dialog' aria-modal='true' aria-labelledby='terms-title' className='flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl'>
        <div className='flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5'>
          <div>
            <h2 id='terms-title' className='text-xl font-bold text-slate-900'>Terms and Conditions</h2>
            <p className='mt-1 text-xs text-slate-500'>SkedLink · {TERMS_VERSION}</p>
          </div>
          <button type='button' onClick={onClose} aria-label='Close Terms and Conditions' className='rounded-lg px-2 py-1 text-2xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800' autoFocus>×</button>
        </div>
        <div className='overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-700'>
          <p>These terms explain how you may use SkedLink. They apply to both Tenant and Landlord accounts and do not replace a separate rental agreement.</p>
          {sections.map(section => (
            <section key={section.title} className='mt-5'>
              <h3 className='font-semibold text-slate-900'>{section.title}</h3>
              <p className='mt-1'>{section.body}</p>
            </section>
          ))}
        </div>
        <div className='border-t border-slate-200 px-6 py-4 text-right'>
          <button type='button' onClick={onClose} className='rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700'>Close</button>
        </div>
      </div>
    </div>
  )
}
