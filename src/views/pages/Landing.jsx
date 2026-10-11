import React, { useState } from 'react'

const TENANT_FEATURES = [
  {
    icon: 'bi-calendar-week-fill',
    grad: 'from-violet-500 to-indigo-500',
    title: 'Weekly Schedule Painter',
    desc: 'Paint your 24-hour lifestyle across all 7 days — Sleep, At School, Working, and custom activities like "Gym" or "Part-time Job." Your schedule becomes your compatibility profile.'
  },
  {
    icon: 'bi-bullseye',
    grad: 'from-indigo-500 to-cyan-500',
    title: 'Compatibility Scores',
    desc: 'Each property gets a live match percentage based on how well your quiet hours align with current tenants. Know your fit before you even send a message.'
  },
  {
    icon: 'bi-funnel-fill',
    grad: 'from-cyan-500 to-teal-500',
    title: 'Smart Property Filters',
    desc: 'Compare shared beds and private rooms with nightly, weekly, or monthly rates, minimum stays, utility policies, and amenities.'
  },
  {
    icon: 'bi-receipt',
    grad: 'from-emerald-500 to-teal-500',
    title: 'Itemized Bills & Payments',
    desc: 'See rent, utilities, and maintenance separately. Pay through checkout, download payment records, and request to apply your reusable advance rent.'
  },
  {
    icon: 'bi-check2-circle',
    grad: 'from-amber-500 to-orange-500',
    title: 'Chore Tracking',
    desc: 'See your assigned chores with due dates and recurrence. Mark them done for landlord verification. Fair auto-assignment means no one person does all the work.'
  },
  {
    icon: 'bi-tools',
    grad: 'from-rose-500 to-pink-500',
    title: 'Maintenance Requests',
    desc: 'Report a leaking faucet or broken lock with a priority level — Low, Medium, or High-Urgent. Track status updates from your landlord in real time.'
  },
]

const LANDLORD_FEATURES = [
  {
    icon: 'bi-building-add',
    grad: 'from-indigo-500 to-violet-500',
    title: 'Property Listings',
    desc: 'Post properties with a photo gallery, map pin, amenities, curfew rules, gender restrictions, house rules, and emergency contacts — everything a tenant needs to decide.'
  },
  {
    icon: 'bi-patch-check-fill',
    grad: 'from-violet-500 to-purple-500',
    title: 'Landlord Verification',
    desc: 'Upload your Government ID and Proof of Property Ownership. Once both are on file, your listings automatically earn a "Verified Landlord" badge that tenants can trust.'
  },
  {
    icon: 'bi-shield-check',
    grad: 'from-emerald-500 to-teal-500',
    title: 'Permit Management',
    desc: 'Upload Business Permit, Fire Safety Certificate, and Sanitary Permit per property. Tenants see a clear verification badge — building trust before they even inquire.'
  },
  {
    icon: 'bi-cash-coin',
    grad: 'from-amber-500 to-yellow-500',
    title: 'Billing & Revenue',
    desc: 'Generate itemized rent and utility bills, explain maintenance charges, and track confirmed payments. Paid plans include revenue analytics and report export.'
  },
  {
    icon: 'bi-list-check',
    grad: 'from-rose-500 to-pink-500',
    title: 'Chore & Maintenance Management',
    desc: 'Create chores with smart auto-assign (fewest chores gets the next task), set recurring schedules, verify completions, and manage maintenance requests by priority and status.'
  },
  {
    icon: 'bi-megaphone-fill',
    grad: 'from-cyan-500 to-indigo-500',
    title: 'Announcements & Move-Outs',
    desc: 'Post pinned or regular announcements to notify all tenants instantly. Review and confirm move-out requests, or remove tenants when needed — all with automatic notifications.'
  },
]

const STEPS = [
  {
    n: '01',
    icon: 'bi-person-badge',
    title: 'Build Your Profile',
    tenant: 'Paint your weekly schedule, upload a valid ID, and fill in your bio so landlords know who you are.',
    landlord: 'Add your properties with photos and permits, upload your Gov ID + ownership proof to get Verified.'
  },
  {
    n: '02',
    icon: 'bi-search-heart',
    title: 'Find the Right Fit',
    tenant: 'Browse properties with live compatibility scores, filter by price and amenities, and view them on a map.',
    landlord: 'Review applications and agreed rental terms, then exchange a private contract with the seeker.'
  },
  {
    n: '03',
    icon: 'bi-chat-dots-fill',
    title: 'Connect & Move In',
    tenant: 'Apply, return your signed contract, and complete your move-in payment before joining your household.',
    landlord: 'Approve a tenant and the system automatically sets up their first rent bill and group chat access.'
  },
  {
    n: '04',
    icon: 'bi-house-heart-fill',
    title: 'Manage Together',
    tenant: 'Pay bills, complete chores, report issues, chat with housemates — everything from one dashboard.',
    landlord: 'Manage bills, chores, maintenance, and announcements for all your properties from one place.'
  },
]

const SHARED_FEATURES = [
  {
    icon: 'bi-chat-dots-fill',
    grad: 'from-violet-500 to-indigo-500',
    title: 'Three-Layer Messaging',
    desc: 'Inquiry chats between tenant and landlord, private DMs between housemates, and a property-wide group chat — all built in, no third-party apps needed.'
  },
  {
    icon: 'bi-bell-fill',
    grad: 'from-amber-500 to-orange-500',
    title: 'Real-Time Notifications',
    desc: 'Everyone stays informed — rent bills, payment confirmations, chore assignments, maintenance updates, and announcements all arrive as instant in-app notifications.'
  },
  {
    icon: 'bi-person-lines-fill',
    grad: 'from-emerald-500 to-teal-500',
    title: 'Private Household Profiles',
    desc: 'Connect through household messaging. Your contact details, identity documents, weekly schedule, and current activity stay private.'
  },
]

const MOCK_ROWS = [
  { name: 'You',  bars: ['sl','sl','sl','sc','sc','fr','wk','wk','sl','sl','sl','sl'] },
  { name: 'Alex', bars: ['sl','sl','sl','sc','fr','fr','fr','sl','sl','sl','sl','sl'] },
  { name: 'Sam',  bars: ['fr','sl','sl','sl','wk','wk','fr','fr','fr','sl','sl','sl'] },
]
const barColor = { sl: '#8b5cf6', sc: '#6366f1', wk: '#f59e0b', fr: '#334155' }

export const Landing = ({ onGetStarted, onLogin }) => {
  const [activeRole, setActiveRole] = useState('tenant')

  return (
    <div className='min-h-screen bg-white' style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── NAV ── */}
      <nav className='fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100'>
        <div className='max-w-6xl mx-auto px-6 h-16 flex items-center justify-between'>
          <div className='flex items-center gap-2.5'>
            <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center'>
              <i className='bi bi-lightning-charge-fill text-white text-sm' />
            </div>
            <span className='text-lg font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Sked<span className='text-indigo-600'>Link</span>
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <button onClick={onLogin} className='px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all'>
              Log In
            </button>
            <button onClick={onGetStarted} className='px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl hover:from-violet-700 hover:to-indigo-700 shadow-md transition-all active:scale-95'>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className='relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950'>
        <div className='absolute inset-0 pointer-events-none overflow-hidden'>
          <div className='absolute -top-32 -right-32 w-80 h-80 bg-violet-600/25 rounded-full blur-3xl' />
          <div className='absolute top-1/2 left-0 w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl' />
          <div className='absolute bottom-0 right-1/4 w-96 h-96 bg-violet-800/15 rounded-full blur-3xl' />
        </div>

        <div className='relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8 py-20'>
          <div className='inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur border border-white/20 rounded-full text-sm text-white/80'>
            <span className='w-2 h-2 bg-emerald-400 rounded-full animate-pulse' />
            Schedule-Based Dormitory &amp; Rental Management
          </div>

          <div className='space-y-2'>
            <h1 className='text-5xl md:text-7xl font-bold text-white leading-[1.08]' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Find Where You
            </h1>
            <h1 className='text-5xl md:text-7xl font-bold leading-[1.08] bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Truly Belong
            </h1>
          </div>

          <p className='text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed'>
            SkedLink matches tenants with dormitories and rentals based on real lifestyle compatibility — not just price. Landlords get a full management platform. Tenants get a home that actually fits.
          </p>

          <div className='flex flex-col sm:flex-row gap-3 justify-center'>
            <button onClick={onGetStarted} className='px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl hover:from-violet-700 hover:to-indigo-700 shadow-[0_8px_32px_-4px_rgba(109,40,217,0.6)] hover:shadow-[0_12px_40px_-4px_rgba(109,40,217,0.7)] transition-all hover:-translate-y-0.5 active:scale-95'>
              Get Started Free <i className='bi bi-arrow-right ms-1' />
            </button>
            <button onClick={onLogin} className='px-8 py-4 text-base font-semibold text-white bg-white/10 backdrop-blur border border-white/20 rounded-2xl hover:bg-white/20 transition-all'>
              Sign In
            </button>
          </div>

          {/* Mock schedule preview */}
          <div className='mt-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-5 text-left max-w-xl mx-auto shadow-2xl'>
            <div className='flex items-center gap-1.5 mb-4'>
              <div className='w-2.5 h-2.5 rounded-full bg-rose-400' />
              <div className='w-2.5 h-2.5 rounded-full bg-amber-400' />
              <div className='w-2.5 h-2.5 rounded-full bg-emerald-400' />
              <span className='ml-2 text-[11px] text-white/40'>SkedLink — Schedule Compatibility</span>
            </div>
            <div className='space-y-2'>
              {MOCK_ROWS.map((row, ri) => (
                <div key={ri} className='flex items-center gap-2'>
                  <span className='text-[11px] text-white/50 w-7 shrink-0 font-medium'>{row.name}</span>
                  <div className='flex flex-1 gap-px rounded overflow-hidden'>
                    {row.bars.map((t, i) => (
                      <div key={i} className='h-5 flex-1' style={{ backgroundColor: barColor[t] + 'cc' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className='mt-3 flex items-center justify-between'>
              <div className='flex gap-3'>
                {[['#8b5cf6','Sleep'],['#6366f1','School'],['#f59e0b','Work']].map(([c,l]) => (
                  <div key={l} className='flex items-center gap-1'>
                    <div className='w-2 h-2 rounded-sm' style={{ backgroundColor: c }} />
                    <span className='text-[10px] text-white/50'>{l}</span>
                  </div>
                ))}
              </div>
              <div className='px-2.5 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-[11px] text-emerald-400 font-bold'>
                88% Match
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TWO ROLES ── */}
      <section className='py-20 bg-white'>
        <div className='max-w-6xl mx-auto px-6'>
          <div className='text-center mb-12 space-y-3'>
            <span className='text-xs font-bold text-indigo-600 uppercase tracking-widest'>Built for Two Roles</span>
            <h2 className='text-4xl font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              One platform, two complete experiences
            </h2>
            <p className='text-slate-500 max-w-xl mx-auto leading-relaxed'>
              Whether you're looking for a room or managing a property, SkedLink has everything you need — no separate apps, no third-party tools.
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
            {/* Tenant card */}
            <div className='relative p-8 rounded-3xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-indigo-100 overflow-hidden'>
              <div className='absolute top-0 right-0 w-40 h-40 bg-indigo-100/50 rounded-full -translate-y-10 translate-x-10 blur-2xl' />
              <div className='relative'>
                <div className='flex items-center gap-3 mb-6'>
                  <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg'>
                    <i className='bi bi-search-heart text-white text-xl' />
                  </div>
                  <div>
                    <p className='text-xs font-bold text-indigo-500 uppercase tracking-wide'>For Tenants</p>
                    <h3 className='text-xl font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Find the Right Home</h3>
                  </div>
                </div>
                <ul className='space-y-3'>
                  {[
                    'Paint your weekly schedule to generate a compatibility profile',
                    'Browse properties with live match percentages, photos & map',
                    'Filter by type, price, gender restriction & amenities',
                    'Send inquiries and chat with landlords directly',
                    'Pay itemized bills and view confirmed receipts',
                    'Track chores, report maintenance issues, stay updated',
                    'Chat with housemates — privately or in the group',
                    'Keep your schedule and personal details private',
                  ].map(item => (
                    <li key={item} className='flex items-start gap-2.5 text-sm text-slate-700'>
                      <i className='bi bi-check-circle-fill text-indigo-500 text-sm shrink-0 mt-0.5' />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Landlord card */}
            <div className='relative p-8 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 overflow-hidden'>
              <div className='absolute top-0 right-0 w-40 h-40 bg-amber-100/50 rounded-full -translate-y-10 translate-x-10 blur-2xl' />
              <div className='relative'>
                <div className='flex items-center gap-3 mb-6'>
                  <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg'>
                    <i className='bi bi-building-gear text-white text-xl' />
                  </div>
                  <div>
                    <p className='text-xs font-bold text-amber-600 uppercase tracking-wide'>For Landlords</p>
                    <h3 className='text-xl font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Manage with Confidence</h3>
                  </div>
                </div>
                <ul className='space-y-3'>
                  {[
                    'List properties with photos, map pin, permits & house rules',
                    'Earn a Verified Landlord badge with ID + ownership proof',
                    'Exchange signed contracts before requesting move-in payment',
                    'Auto-generated monthly rent bills per tenant',
                    'Post itemized charges and manage reusable advance balances',
                    'Assign and verify chores — auto-assign for fairness',
                    'Track maintenance requests by priority and status',
                    'Post announcements and manage move-out requests',
                  ].map(item => (
                    <li key={item} className='flex items-start gap-2.5 text-sm text-slate-700'>
                      <i className='bi bi-check-circle-fill text-amber-500 text-sm shrink-0 mt-0.5' />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className='py-24 bg-slate-50'>
        <div className='max-w-6xl mx-auto px-6'>
          <div className='text-center mb-4 space-y-3'>
            <span className='text-xs font-bold text-indigo-600 uppercase tracking-widest'>Feature Breakdown</span>
            <h2 className='text-4xl font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Everything for peaceful shared living
            </h2>
          </div>

          {/* Role toggle */}
          <div className='flex justify-center mb-12'>
            <div className='flex gap-1 bg-slate-200 rounded-2xl p-1'>
              <button
                onClick={() => setActiveRole('tenant')}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeRole === 'tenant' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <i className='bi bi-search-heart mr-2' />For Tenants
              </button>
              <button
                onClick={() => setActiveRole('landlord')}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeRole === 'landlord' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <i className='bi bi-building-gear mr-2' />For Landlords
              </button>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12'>
            {(activeRole === 'tenant' ? TENANT_FEATURES : LANDLORD_FEATURES).map(f => (
              <div key={f.title} className='group p-6 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50/50 transition-all duration-300 cursor-default'>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.grad} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                  <i className={`bi ${f.icon} text-white text-lg`} />
                </div>
                <h3 className='font-bold text-slate-900 mb-1.5' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{f.title}</h3>
                <p className='text-sm text-slate-500 leading-relaxed'>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Shared features */}
          <div className='pt-6 border-t border-slate-200'>
            <p className='text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-6'>Shared by Both Roles</p>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-5'>
              {SHARED_FEATURES.map(f => (
                <div key={f.title} className='group p-6 bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-all duration-300 cursor-default'>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.grad} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                    <i className={`bi ${f.icon} text-white text-lg`} />
                  </div>
                  <h3 className='font-bold text-slate-900 mb-1.5' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{f.title}</h3>
                  <p className='text-sm text-slate-500 leading-relaxed'>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className='py-24 bg-white'>
        <div className='max-w-5xl mx-auto px-6'>
          <div className='text-center mb-16 space-y-3'>
            <span className='text-xs font-bold text-indigo-600 uppercase tracking-widest'>How it Works</span>
            <h2 className='text-4xl font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              From profile to home in four steps
            </h2>
            <p className='text-slate-500 max-w-xl mx-auto'>The same four steps work for both tenants and landlords — the experience adapts to your role.</p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {STEPS.map((s, i) => (
              <div key={s.n} className='flex gap-5 p-6 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/30 transition-all'>
                <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg'>
                  <i className={`bi ${s.icon} text-white text-xl`} />
                </div>
                <div className='min-w-0'>
                  <div className='flex items-center gap-2 mb-1'>
                    <span className='text-[10px] font-bold text-indigo-400 uppercase tracking-widest'>Step {s.n}</span>
                  </div>
                  <h3 className='font-bold text-slate-900 mb-2' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.title}</h3>
                  <p className='text-xs font-bold text-indigo-600 mb-0.5'>
                    <i className='bi bi-search-heart mr-1' />Tenant
                  </p>
                  <p className='text-sm text-slate-500 leading-relaxed mb-2'>{s.tenant}</p>
                  <p className='text-xs font-bold text-amber-600 mb-0.5'>
                    <i className='bi bi-building-gear mr-1' />Landlord
                  </p>
                  <p className='text-sm text-slate-500 leading-relaxed'>{s.landlord}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className='py-24 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 relative overflow-hidden'>
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute top-0 left-1/3 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl' />
          <div className='absolute bottom-0 right-1/3 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl' />
        </div>
        <div className='relative max-w-3xl mx-auto px-6 text-center space-y-6'>
          <h2 className='text-4xl md:text-5xl font-bold text-white leading-tight' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Your perfect home<br />
            <span className='bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent'>
              is a schedule away.
            </span>
          </h2>
          <p className='text-lg text-slate-300 max-w-md mx-auto'>
            Join as a tenant to find your match, or as a landlord to manage your property — all for free.
          </p>
          <div className='flex flex-col sm:flex-row gap-3 justify-center pt-2'>
            <button onClick={onGetStarted} className='px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl hover:from-violet-700 hover:to-indigo-700 shadow-[0_8px_32px_-4px_rgba(109,40,217,0.6)] transition-all hover:-translate-y-0.5 active:scale-95'>
              Get Started Free <i className='bi bi-arrow-right ms-1' />
            </button>
            <button onClick={onLogin} className='px-8 py-4 text-base font-semibold text-white bg-white/10 backdrop-blur border border-white/20 rounded-2xl hover:bg-white/20 transition-all'>
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className='py-8 bg-slate-900 border-t border-white/5'>
        <div className='max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <div className='w-6 h-6 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center'>
              <i className='bi bi-lightning-charge-fill text-white text-xs' />
            </div>
            <span className='text-sm font-bold text-white' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>SkedLink</span>
          </div>
          <p className='text-xs text-slate-500'>© 2025 SkedLink. Schedule-based dormitory matching for Filipino students &amp; young professionals.</p>
        </div>
      </footer>
    </div>
  )
}
