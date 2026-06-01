import React, { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../../firebase'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const DEFAULT_HEX = {
  sleep: '#6366f1',
  school: '#3b82f6',
  work: '#f59e0b',
  dayoff: '#10b981',
  out: '#f97316',
}

const getHex = (actId, customActivities = []) => {
  if (DEFAULT_HEX[actId]) return DEFAULT_HEX[actId]
  const custom = customActivities.find(a => a.id === actId)
  return custom?.hex || '#e2e8f0'
}

const ACTIVITY_LABEL = { sleep: 'Sleep', school: 'At School', work: 'Working', dayoff: 'Day Off', out: 'Out of House' }

export const TenantDetailModal = ({ tenantUid, tenantName, onClose }) => {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    getDoc(doc(db, 'users', tenantUid))
      .then(snap => { if (snap.exists()) setProfile(snap.data()) })
      .finally(() => setLoading(false))
  }, [tenantUid])

  const hasSchedule = profile?.weeklySchedule && Object.keys(profile.weeklySchedule).length > 0

  return (
    <>
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6'>
        <div
          className='w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden'
          style={{ maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className='px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0'>
            <h2 className='font-semibold text-slate-900 text-lg'>Tenant Profile</h2>
            <button
              onClick={onClose}
              className='text-slate-400 hover:text-slate-700 text-2xl font-light leading-none'
            >
              ×
            </button>
          </div>

          <div className='overflow-y-auto flex-1 p-6 space-y-6'>
            {loading ? (
              <div className='text-center py-16 text-slate-500'>Loading tenant profile...</div>
            ) : !profile ? (
              <div className='text-center py-16 text-slate-500'>Profile not found.</div>
            ) : (
              <>
                {/* Avatar + name */}
                <div className='flex items-center gap-4'>
                  <div className='w-16 h-16 rounded-full overflow-hidden bg-indigo-100 border-2 border-indigo-200 shrink-0'>
                    {profile.profilePhoto
                      ? <img src={profile.profilePhoto} alt='' className='w-full h-full object-cover' />
                      : <div className='w-full h-full flex items-center justify-center text-2xl font-bold text-indigo-600'>
                          {(profile.fullName || tenantName || '?').charAt(0).toUpperCase()}
                        </div>
                    }
                  </div>
                  <div>
                    <h3 className='text-xl font-bold text-slate-900'>{profile.fullName || tenantName}</h3>
                    <p className='text-sm text-slate-500'>{profile.email}</p>
                    {profile.occupation && (
                      <p className='text-sm text-indigo-600 font-medium mt-0.5'>{profile.occupation}</p>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className='grid grid-cols-2 gap-3'>
                  {[
                    { label: 'Phone', value: profile.phone || '—' },
                    { label: 'Gender', value: profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '—' },
                    { label: 'Age', value: profile.age ? `${profile.age} years old` : '—' },
                    { label: 'Occupation', value: profile.occupation || '—' },
                  ].map(item => (
                    <div key={item.label} className='p-3 bg-slate-50 rounded-xl'>
                      <p className='text-xs text-slate-400 font-medium mb-0.5'>{item.label}</p>
                      <p className='text-sm font-semibold text-slate-900'>{item.value}</p>
                    </div>
                  ))}
                </div>

                {profile.bio && (
                  <div className='p-4 bg-slate-50 rounded-xl'>
                    <p className='text-xs text-slate-400 font-medium mb-1'>About</p>
                    <p className='text-sm text-slate-700 leading-relaxed'>{profile.bio}</p>
                  </div>
                )}

                {/* Valid ID */}
                {profile.validIdUrl ? (
                  <div>
                    <p className='text-sm font-semibold text-slate-900 mb-2'>Valid ID</p>
                    <div
                      className='rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in'
                      onClick={() => setLightbox(profile.validIdUrl)}
                    >
                      <img
                        src={profile.validIdUrl}
                        alt='Valid ID'
                        className='w-full object-contain max-h-52 hover:opacity-95 transition-opacity'
                      />
                    </div>
                    <p className='text-xs text-slate-400 mt-1'>Click to view full size</p>
                  </div>
                ) : (
                  <div className='p-4 bg-amber-50 rounded-xl border border-amber-200'>
                    <p className='text-sm text-amber-700 font-medium'>No valid ID uploaded yet.</p>
                  </div>
                )}

                {/* Weekly Schedule */}
                {hasSchedule ? (
                  <div>
                    <p className='text-sm font-semibold text-slate-900 mb-3'>Weekly Schedule</p>
                    <div className='overflow-x-auto'>
                      <div style={{ minWidth: 320 }}>
                        {/* Time labels */}
                        <div className='flex mb-1 pl-9'>
                          {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                            <div key={h} className='flex-1 text-center text-xs text-slate-400'>
                              {h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}
                            </div>
                          ))}
                        </div>
                        {/* Grid */}
                        {DAYS.map(day => (
                          <div key={day} className='flex items-center mb-0.5 gap-1'>
                            <div className='w-8 text-xs text-slate-500 font-medium shrink-0 text-right pr-1'>
                              {DAY_LABELS[day]}
                            </div>
                            <div className='flex flex-1 gap-px'>
                              {HOURS.map(h => {
                                const actId = profile.weeklySchedule[day]?.[String(h)] ||
                                  profile.weeklySchedule[day]?.[h] || 'dayoff'
                                return (
                                  <div
                                    key={h}
                                    style={{ height: 14, flex: 1, backgroundColor: getHex(actId, profile.customActivities || []) }}
                                    className='rounded-sm'
                                    title={ACTIVITY_LABEL[actId] || actId}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        ))}
                        {/* Legend */}
                        <div className='flex flex-wrap gap-x-4 gap-y-1 mt-3 pl-9'>
                          {Object.entries(DEFAULT_HEX).map(([id, hex]) => (
                            <div key={id} className='flex items-center gap-1.5'>
                              <div style={{ width: 10, height: 10, backgroundColor: hex, borderRadius: 2 }} />
                              <span className='text-xs text-slate-500'>{ACTIVITY_LABEL[id]}</span>
                            </div>
                          ))}
                          {(profile.customActivities || []).map(act => (
                            <div key={act.id} className='flex items-center gap-1.5'>
                              <div style={{ width: 10, height: 10, backgroundColor: act.hex, borderRadius: 2 }} />
                              <span className='text-xs text-slate-500'>{act.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className='p-4 bg-slate-50 rounded-xl border border-slate-200'>
                    <p className='text-sm text-slate-500'>This tenant hasn't set up their schedule yet.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ID lightbox */}
      {lightbox && (
        <div
          className='fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4'
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt='Full size ID' className='max-w-full max-h-full object-contain rounded-lg' />
          <button
            className='absolute top-4 right-4 text-white text-3xl font-light leading-none hover:text-slate-300'
            onClick={() => setLightbox(null)}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
