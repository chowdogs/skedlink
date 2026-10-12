import { ApplicationsPanel } from '../components/property/ApplicationsPanel'
import { PaymentsPanel } from '../components/billing/PaymentsPanel'
import { priceLabel, formatDate, rentalRate } from '../../lib/rentalTerms'
import { platform } from '../../lib/platform'
import React, { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Input, Label } from '../ui/Input'
import { SchedulePainter } from '../components/schedule/SchedulePainter'
import { PropertyMap } from '../components/map/PropertyMap'
import { ContactModal } from '../components/property/ContactModal'
import { TenantDetailModal } from '../components/property/TenantDetailModal'
import { ConfirmModal } from '../ui/ConfirmModal'
import { useMessages } from '../../contexts/MessagesContext'
import { useSchedulePainter } from '../../controllers/useSchedulePainter'
import { useCompatibility } from '../../controllers/useCompatibility'
import { useAuth } from '../../contexts/AuthContext'
import { compressToBase64 } from '../../lib/compressToBase64'
import { notify } from '../../lib/notify'


const PhotoGrid = ({ photos, onPhotoClick }) => {
  if (!photos || photos.length === 0) {
    return <div className='h-44 bg-slate-100 flex items-center justify-center rounded-t-2xl'><p className='text-slate-400 text-sm'>No photos</p></div>
  }
  if (photos.length === 1) {
    return <img src={photos[0]} alt='' className='w-full h-44 object-cover cursor-pointer hover:opacity-95 transition-opacity rounded-t-2xl' onClick={() => onPhotoClick(photos[0])} />
  }
  return (
    <div className='grid h-44 rounded-t-2xl overflow-hidden' style={{ gridTemplateColumns: '2fr 1fr' }}>
      <img src={photos[0]} alt='' className='w-full h-44 object-cover cursor-pointer hover:opacity-95 transition-opacity border-r-2 border-white' onClick={() => onPhotoClick(photos[0])} />
      <div className='flex flex-col'>
        {photos.slice(1, 3).map((src, i) => (
          <div key={i} className='flex-1 relative cursor-pointer hover:opacity-95 transition-opacity' onClick={() => onPhotoClick(src)} style={{ borderTop: i > 0 ? '2px solid white' : undefined }}>
            <img src={src} alt='' className='w-full h-full object-cover' />
            {i === 1 && photos.length > 3 && (
              <div className='absolute inset-0 bg-black/50 flex items-center justify-center'>
                <p className='text-white font-bold text-lg'>+{photos.length - 3}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const OCCUPATIONS = [
  'Studying', 'Working', 'Studying & Working',
  'Business Owner', 'Freelancer', 'Remote Worker', 'Other'
]

const PROPERTY_TYPES = ['Condo/Apartment', 'Studio', 'Room', 'House', 'Townhouse']
const FILTER_AMENITIES = ['Parking', 'Pool', 'Gym', 'WiFi', 'Aircon', 'Balcony', 'Security', 'Laundry', 'Pets Allowed', 'Kitchen', 'Generator']
const PRIORITY_CFG = {
  low:    { label: 'Low',    cls: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', cls: 'bg-amber-100 text-amber-700' },
  high:   { label: 'High',   cls: 'bg-rose-100 text-rose-600' },
}
const MAINT_STATUS = {
  open:        { label: 'Open',        cls: 'bg-rose-100 text-rose-700' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700' },
  resolved:    { label: 'Resolved',    cls: 'bg-emerald-100 text-emerald-700' },
}

const PERMIT_DEFS = [
  { key: 'business',   label: 'Business Permit',          icon: 'bi-building-check'    },
  { key: 'fireSafety', label: 'Fire Safety Certificate',   icon: 'bi-shield-check'      },
  { key: 'sanitary',   label: 'Sanitary Permit',           icon: 'bi-clipboard2-pulse'  },
]

const openPermit = (permit) => {
  if (!permit?.data) return
  try {
    const [header, b64] = permit.data.split(',')
    const mime = header.split(':')[1]?.split(';')[0] || (permit.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg')
    const bytes = atob(b64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch (err) {
    console.error('Could not open permit:', err)
  }
}

const ViewPermits = ({ permits }) => {
  const [open, setOpen] = useState(false)
  const p = permits || {}
  const count = PERMIT_DEFS.filter(d => p[d.key]).length
  const verified = count === 3
  return (
    <div className={`rounded-xl border overflow-hidden ${verified ? 'border-emerald-200' : count > 0 ? 'border-amber-200' : 'border-slate-200'}`}>
      <button
        type='button'
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
          verified ? 'bg-emerald-50 hover:bg-emerald-100' : count > 0 ? 'bg-amber-50 hover:bg-amber-100' : 'bg-slate-50 hover:bg-slate-100'
        }`}
      >
        <div className='flex items-center gap-2'>
          <i className={`bi ${verified ? 'bi-patch-check-fill text-emerald-600' : count > 0 ? 'bi-exclamation-triangle-fill text-amber-500' : 'bi-file-earmark-text text-slate-400'}`} />
          <span className={`text-xs font-semibold ${verified ? 'text-emerald-700' : count > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
            {verified ? 'Verified — All Permits Uploaded' : `View Permits (${count}/3 uploaded)`}
          </span>
        </div>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'} text-xs text-slate-400`} />
      </button>
      {open && (
        <div className='px-3 py-3 space-y-2.5 bg-white'>
          {PERMIT_DEFS.map(def => {
            const permit = p[def.key]
            return (
              <div key={def.key} className='flex items-center gap-2.5'>
                <i className={`bi ${def.icon} text-sm ${permit ? 'text-indigo-500' : 'text-slate-300'}`} />
                <span className='text-xs text-slate-700 flex-1'>{def.label}</span>
                {permit ? (
                  <button
                    type='button'
                    onClick={() => openPermit(permit)}
                    className='text-xs text-indigo-600 font-semibold hover:text-indigo-800 px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-200 transition-colors whitespace-nowrap'
                  >
                    <i className='bi bi-eye mr-1' />View
                  </button>
                ) : (
                  <span className='text-xs text-slate-400 italic'>Not provided</span>
                )}
              </div>
            )
          })}
          {count < 3 && (
            <p className='text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-1'>
              <i className='bi bi-info-circle mr-1' />
              This property is missing {3 - count} permit{3 - count > 1 ? 's' : ''}. Proceed with caution.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const AmenitiesDisplay = ({ amenities }) => {
  const [expanded, setExpanded] = useState(false)
  if (!amenities?.length) return null
  const visible = expanded ? amenities : amenities.slice(0, 4)
  const hidden = amenities.length - 4
  return (
    <div className='flex flex-wrap gap-1.5'>
      {visible.map(a => (
        <span key={a} className='px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-full'>{a}</span>
      ))}
      {!expanded && hidden > 0 && (
        <button
          type='button'
          onClick={() => setExpanded(true)}
          className='px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs rounded-full hover:bg-indigo-100 transition-colors font-medium'
        >
          +{hidden} more
        </button>
      )}
      {expanded && (
        <button
          type='button'
          onClick={() => setExpanded(false)}
          className='px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-400 text-xs rounded-full hover:bg-slate-100 transition-colors'
        >
          Show less
        </button>
      )}
    </div>
  )
}

export const SeekerDashboard = ({ user }) => {
  const { updateUserProfile, changePassword, logout } = useAuth()
  const { openConversation } = useMessages()
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).has('checkout') ? 'payments' : 'overview')
  const [saveMsg, setSaveMsg] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [contactProperty, setContactProperty] = useState(null)
  const [myInquiries, setMyInquiries] = useState([])
  const [lightboxImage, setLightboxImage] = useState(null)
  const [homeProperty, setHomeProperty] = useState(null)
  const [viewingTenant, setViewingTenant] = useState(null)
  const [moveoutRequests, setMoveoutRequests] = useState([])
  const [showMoveoutForm, setShowMoveoutForm] = useState(false)
  const [moveoutDate, setMoveoutDate] = useState('')
  const [moveoutReason, setMoveoutReason] = useState('')
  const [moveoutSaving, setMoveoutSaving] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [maintenanceRequests, setMaintenanceRequests] = useState([])
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
  const [maintenanceTitle, setMaintenanceTitle] = useState('')
  const [maintenanceDesc, setMaintenanceDesc] = useState('')
  const [maintenancePriority, setMaintenancePriority] = useState('medium')
  const [maintenanceSaving, setMaintenanceSaving] = useState(false)
  const [announcements, setAnnouncements] = useState([])
  const [filterType, setFilterType] = useState('')
  const [filterPriceMin, setFilterPriceMin] = useState('')
  const [filterPriceMax, setFilterPriceMax] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [filterAmenities, setFilterAmenities] = useState([])
  const [showFilters, setShowFilters] = useState(false)

  const schedulePainter = useSchedulePainter(user.uid)
  const compatibility = useCompatibility(user)

  const scheduleComplete = schedulePainter.loaded &&
    Object.values(schedulePainter.schedule || {}).some(day =>
      Object.values(day || {}).length > 0
    )

  const displayName = user.fullName || user.name || 'Tenant'

  useEffect(() => {
    const q = query(collection(db, 'inquiries'), where('tenantUid', '==', user.uid))
    return onSnapshot(q, snap => {
      setMyInquiries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [user.uid])

  const approvedInquiry = myInquiries.find(i => i.status === 'approved') ?? null

  useEffect(() => {
    if (!approvedInquiry?.propertyId) { setHomeProperty(null); return }
    return onSnapshot(doc(db, 'properties', approvedInquiry.propertyId), snap => {
      setHomeProperty(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    })
  }, [approvedInquiry?.propertyId])

  useEffect(() => {
    const q = query(collection(db, 'moveoutRequests'), where('tenantUid', '==', user.uid))
    return onSnapshot(q, snap => setMoveoutRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [user.uid])

  useEffect(() => {
    if (!approvedInquiry?.propertyId) { setMaintenanceRequests([]); return }
    const q = query(collection(db, 'maintenanceRequests'), where('tenantUid', '==', user.uid))
    return onSnapshot(q, snap => setMaintenanceRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [user.uid, approvedInquiry?.propertyId])

  useEffect(() => {
    if (!approvedInquiry?.propertyId) { setAnnouncements([]); return }
    const q = query(collection(db, 'announcements'), where('propertyId', '==', approvedInquiry.propertyId))
    return onSnapshot(q, snap => setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [approvedInquiry?.propertyId])

  const myMoveoutRequest = moveoutRequests.find(r => r.status === 'pending') ?? null

  const handleCancelInquiry = (inqId) => {
    setDialog({
      title: 'Cancel Inquiry',
      message: 'Are you sure you want to cancel this inquiry? This cannot be undone.',
      variant: 'danger',
      icon: 'bi-send-x-fill',
      confirmLabel: 'Cancel Inquiry',
      onConfirm: async () => { await platform('cancelApplication', { id: inqId }) },
    })
  }

  const handleRequestMoveout = async () => {
    if (!moveoutDate || !approvedInquiry) return
    setMoveoutSaving(true)
    try {
      await addDoc(collection(db, 'moveoutRequests'), {
        tenantUid: user.uid,
        tenantName: displayName,
        propertyId: approvedInquiry.propertyId,
        propertyTitle: homeProperty?.title || approvedInquiry.propertyTitle || '',
        landlordUid: approvedInquiry.landlordUid,
        moveOutDate: moveoutDate,
        reason: moveoutReason.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      await notify(approvedInquiry.landlordUid, {
        type: 'moveout',
        title: 'Move-Out Request',
        body: `${displayName} has requested to move out on ${moveoutDate}.${moveoutReason ? ` Reason: ${moveoutReason}` : ''}`,
        tab: 'properties',
      })
      setShowMoveoutForm(false)
      setMoveoutDate('')
      setMoveoutReason('')
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setMoveoutSaving(false)
    }
  }

  const handleCancelMoveoutRequest = () => {
    if (!myMoveoutRequest) return
    setDialog({
      title: 'Cancel Move-Out Request',
      message: 'Your move-out request will be withdrawn. You can submit a new one anytime.',
      variant: 'danger',
      icon: 'bi-box-arrow-right',
      confirmLabel: 'Yes, Cancel Request',
      onConfirm: async () => {
        await updateDoc(doc(db, 'moveoutRequests', myMoveoutRequest.id), { status: 'cancelled' })
      },
    })
  }

  const handleSubmitMaintenance = async () => {
    if (!maintenanceTitle.trim() || !approvedInquiry) return
    setMaintenanceSaving(true)
    try {
      await addDoc(collection(db, 'maintenanceRequests'), {
        propertyId: approvedInquiry.propertyId,
        propertyTitle: homeProperty?.title || '',
        landlordUid: approvedInquiry.landlordUid,
        tenantUid: user.uid,
        tenantName: displayName,
        title: maintenanceTitle.trim(),
        description: maintenanceDesc.trim(),
        priority: maintenancePriority,
        status: 'open',
        createdAt: serverTimestamp(),
      })
      await notify(approvedInquiry.landlordUid, {
        type: 'default',
        title: 'Maintenance Request Submitted',
        body: `${displayName} submitted a ${maintenancePriority}-priority request: "${maintenanceTitle.trim()}"`,
        tab: 'properties',
      })
      setShowMaintenanceForm(false)
      setMaintenanceTitle('')
      setMaintenanceDesc('')
      setMaintenancePriority('medium')
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setMaintenanceSaving(false)
    }
  }

  // Profile state
  const [profilePhoto, setProfilePhoto] = useState(user.profilePhoto || '')
  const [profileName, setProfileName] = useState(user.fullName || '')
  const [gender, setGender] = useState(user.gender || '')
  const [age, setAge] = useState(user.age || '')
  const [occupation, setOccupation] = useState(user.occupation || '')
  const [bio, setBio] = useState(user.bio || '')
  const [profilePhone, setProfilePhone] = useState(user.phone || '')
  const [validIdUrl, setValidIdUrl] = useState(user.validIdUrl || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [idUploading, setIdUploading] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  const handleSaveSchedule = async () => {
    try {
      await schedulePainter.saveSchedule()
      setSaveMsg('Schedule saved!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg('Failed to save. Try again.')
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const b64 = await compressToBase64(file, { maxPx: 400, quality: 0.8 })
      setProfilePhoto(b64)
      await updateUserProfile({ profilePhoto: b64 })

    } catch (err) {
      setProfileMsg('Photo upload failed: ' + err.message)
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleValidIdUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIdUploading(true)
    try {
      const b64 = await compressToBase64(file, { maxPx: 1200, quality: 0.82 })
      setValidIdUrl(b64)
      await updateUserProfile({ validIdUrl: b64 })
      setProfileMsg('Valid ID uploaded!')
      setTimeout(() => setProfileMsg(''), 3000)
    } catch (err) {
      setProfileMsg('ID upload failed: ' + err.message)
    } finally {
      setIdUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    setProfileMsg('')
    try {
      await updateUserProfile({
        fullName: profileName,
        gender,
        age: age ? Number(age) : '',
        occupation,
        bio,
        phone: profilePhone
      })
      const propagations = []

      for (const inq of myInquiries) {
        propagations.push(updateDoc(doc(db, 'inquiries', inq.id), { tenantName: profileName }))
      }
      await Promise.all(propagations)
      setProfileMsg('Profile updated!')
      setTimeout(() => setProfileMsg(''), 3000)
    } catch (err) {
      setProfileMsg('Error: ' + err.message)
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPwMsg('')
    if (pwNew !== pwConfirm) { setPwMsg('New passwords do not match.'); return }
    if (pwNew.length < 6) { setPwMsg('Password must be at least 6 characters.'); return }
    try {
      await changePassword(pwCurrent, pwNew)
      setPwMsg('Password changed!')
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setTimeout(() => setPwMsg(''), 4000)
    } catch (err) {
      setPwMsg('Error: ' + err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim())
    }
  }

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'schedule', label: 'My Schedule' },
    { id: 'matching', label: 'Property Matches' },
    { id: 'applications', label: 'Applications' },
    { id: 'payments', label: 'Payments' },
    { id: 'myhome', label: 'My Home' },
    { id: 'profile', label: 'My Profile' }
  ]

  const filteredProperties = compatibility.results.filter(p => {
    if (locationFilter && !(p.location?.address || '').toLowerCase().includes(locationFilter.toLowerCase())) return false
    if (filterType && p.propertyType !== filterType) return false
    if (filterPriceMin && rentalRate(p, p.rentalTerms?.occupancy === 'exclusive' ? 'exclusive' : 'shared') < Number(filterPriceMin)) return false
    if (filterPriceMax && rentalRate(p, p.rentalTerms?.occupancy === 'exclusive' ? 'exclusive' : 'shared') > Number(filterPriceMax)) return false
    if (filterGender && filterGender !== 'none' && p.rules?.genderRestriction !== filterGender) return false
    if (filterAmenities.length > 0 && !filterAmenities.every(a => (p.amenities || []).includes(a))) return false
    return true
  })
  const activeFilterCount = [filterType, filterPriceMin, filterPriceMax, filterGender !== '' ? filterGender : '', ...filterAmenities].filter(Boolean).length

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 py-8'>
      {/* Welcome Banner */}
      <div className='mb-8 rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 px-8 py-7 relative overflow-hidden'>
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute -top-8 -right-8 w-48 h-48 bg-white/10 rounded-full blur-2xl' />
          <div className='absolute bottom-0 left-1/3 w-32 h-32 bg-violet-400/20 rounded-full blur-xl' />
        </div>
        <div className='relative'>
          <p className='text-indigo-200 text-sm font-medium mb-1 flex items-center gap-1.5'><i className='bi bi-sun' /> Good day</p>
          <h1 className='text-3xl font-bold text-white' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Welcome back, {displayName}!
          </h1>
          <p className='text-indigo-100 mt-1 text-sm'>{user.occupation || 'Tenant'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className='flex gap-1 mb-8 bg-slate-100 rounded-2xl p-1.5 overflow-x-auto'>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}>
            {tab.label}
            {tab.id === 'myhome' && approvedInquiry && (
              <span className='w-2 h-2 bg-emerald-500 rounded-full' />
            )}
            {tab.id === 'schedule' && !scheduleComplete && schedulePainter.loaded && (
              <span className='w-2 h-2 bg-amber-500 rounded-full' title='Schedule incomplete' />
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className='space-y-6'>
          {/* Schedule incomplete warning */}
          {schedulePainter.loaded && !scheduleComplete && (
            <div className='flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl'>
              <div className='w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0'>
                <i className='bi bi-calendar-x text-amber-600 text-lg' />
              </div>
              <div className='flex-1'>
                <p className='font-semibold text-amber-900 text-sm'>Complete your schedule to unlock features</p>
                <p className='text-amber-700 text-xs mt-0.5'>You need to set your weekly schedule before you can see match percentages or contact landlords.</p>
              </div>
              <button
                onClick={() => setActiveTab('schedule')}
                className='text-xs font-bold text-amber-700 hover:text-amber-900 px-3 py-1.5 bg-amber-100 rounded-lg border border-amber-300 whitespace-nowrap transition-colors'
              >
                Set Schedule
              </button>
            </div>
          )}

          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            {[
              { icon: 'bi-houses', label: 'Properties Found', value: compatibility.results.length, grad: 'from-violet-500 to-indigo-500' },
              { icon: 'bi-bullseye', label: 'Best Match', value: scheduleComplete ? `${compatibility.results[0]?.score ?? 0}%` : '—', grad: 'from-emerald-500 to-teal-500' },
              { icon: 'bi-send', label: 'Inquiries Sent', value: myInquiries.length, grad: 'from-amber-500 to-orange-500' },
              { icon: 'bi-briefcase', label: 'Occupation', value: user.occupation || '—', grad: 'from-indigo-500 to-cyan-500', small: true },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className='flex items-center gap-4 pt-6'>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center shrink-0 shadow-md`}>
                    <i className={`bi ${s.icon} inline-flex items-center justify-center leading-none text-white text-lg`} />
                  </div>
                  <div className='min-w-0'>
                    <p className={`font-bold text-slate-900 truncate ${s.small ? 'text-base' : 'text-2xl'}`} style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</p>
                    <p className='text-xs text-slate-500'>{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {myInquiries.length > 0 && (
            <Card>
              <CardHeader><CardTitle>My Inquiries</CardTitle></CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {myInquiries.map(inq => (
                    <div key={inq.id}
                      className='flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100'>
                      <div className='min-w-0'>
                        <p className='font-medium text-slate-900 text-sm truncate'>{inq.propertyTitle}</p>
                        <p className='text-xs text-slate-500 capitalize'>
                          {inq.type === 'rent' ? 'Wants to rent' : 'Wants to visit'}
                        </p>
                      </div>
                      <div className='flex items-center gap-2 shrink-0'>
                        <Badge variant={inq.status === 'approved' ? 'success' : inq.status === 'active' ? 'primary' : 'warning'}>
                          {inq.status}
                        </Badge>
                        {inq.unreadByTenant && (
                          <span className='w-2 h-2 rounded-full bg-indigo-600' title='New reply' />
                        )}
                        <button
                          type='button'
                          onClick={() => openConversation({ type: 'inquiry', inquiry: inq })}
                          className='text-sm text-indigo-600 font-medium hover:text-indigo-800'
                        >
                          Open →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {activeTab === 'schedule' && (
        <div className='bg-white rounded-xl p-8 shadow-sm border border-slate-200'>
          {!schedulePainter.loaded ? (
            <p className='text-slate-500'>Loading your schedule...</p>
          ) : (
            <>
              <SchedulePainter
                schedule={schedulePainter.schedule}
                onHourChange={schedulePainter.updateHour}
                currentActivity={schedulePainter.currentActivity}
                onActivityChange={schedulePainter.setCurrentActivity}
                allActivities={schedulePainter.allActivities}
                getActivityHex={schedulePainter.getActivityHex}
                customActivities={schedulePainter.customActivities}
                onAddCustomActivity={schedulePainter.addCustomActivity}
                onRemoveCustomActivity={schedulePainter.removeCustomActivity}
              />
              <div className='mt-6 flex items-center gap-3'>
                <Button onClick={schedulePainter.reset} variant='secondary'>Reset</Button>
                <Button onClick={handleSaveSchedule} variant='primary' disabled={schedulePainter.saving}>
                  {schedulePainter.saving ? 'Saving...' : 'Save Schedule'}
                </Button>
                {saveMsg && <span className='text-sm text-emerald-600 font-medium'>{saveMsg}</span>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MATCHING ── */}
      {activeTab === 'matching' && compatibility.error && <p className='p-3 bg-amber-50 text-sm rounded-xl mb-3'>Listings are available. Compatibility scores are temporarily unavailable.</p>}
      {activeTab === 'matching' && (
        <div className='space-y-6'>
          {/* Schedule gate banner */}
          {schedulePainter.loaded && !scheduleComplete ? (
            <div className='flex flex-col items-center justify-center py-16 gap-6'>
              <div className='w-20 h-20 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center'>
                <i className='bi bi-calendar-x text-amber-500 text-4xl' />
              </div>
              <div className='text-center max-w-sm'>
                <h3 className='text-xl font-bold text-slate-900 mb-2' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Complete your schedule first
                </h3>
                <p className='text-slate-500 text-sm leading-relaxed'>
                  You need to paint your weekly schedule before you can view match percentages or contact landlords. This helps us find your best-fit properties.
                </p>
              </div>
              <Button variant='primary' onClick={() => setActiveTab('schedule')}>
                <i className='bi bi-calendar-week mr-2' /> Set Up My Schedule
              </Button>
            </div>
          ) : (
            <>
              <div className='p-4 bg-indigo-50 border border-indigo-200 rounded-lg'>
                <p className='text-sm text-indigo-900'>
                  Compatibility compares your quiet hours (sleep + at school) against existing tenants.
                  Properties with 0 tenants show 100%. Save your schedule first for accurate results.
                </p>
              </div>

              {compatibility.loading ? (
                <div className='text-center py-12 text-slate-500'>Loading properties...</div>
              ) : (
                <>
                  <div className='flex gap-2'>
                    <input
                      type='text'
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      placeholder='Filter by location (e.g. Baliwag, Manila)...'
                      className='flex-1 px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
                    />
                    <button
                      type='button'
                      onClick={() => setShowFilters(v => !v)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${showFilters || activeFilterCount > 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300'}`}
                    >
                      <i className='bi bi-funnel' />
                      Filters
                      {activeFilterCount > 0 && <span className='w-5 h-5 bg-white/20 rounded-full text-xs flex items-center justify-center'>{activeFilterCount}</span>}
                    </button>
                  </div>

                  {showFilters && (
                    <div className='p-4 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm'>
                      <div className='flex items-center justify-between'>
                        <p className='text-sm font-bold text-slate-900'>Search Filters</p>
                        <button type='button' onClick={() => { setFilterType(''); setFilterPriceMin(''); setFilterPriceMax(''); setFilterGender(''); setFilterAmenities([]) }}
                          className='text-xs text-indigo-600 font-semibold hover:text-indigo-800'>Clear all</button>
                      </div>
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div>
                          <p className='text-xs font-semibold text-slate-600 mb-1.5'>Property Type</p>
                          <div className='flex flex-wrap gap-1.5'>
                            {PROPERTY_TYPES.map(t => (
                              <button key={t} type='button' onClick={() => setFilterType(v => v === t ? '' : t)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filterType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className='text-xs font-semibold text-slate-600 mb-1.5'>Price Range (₱/mo)</p>
                          <div className='flex items-center gap-2'>
                            <input type='number' value={filterPriceMin} onChange={e => setFilterPriceMin(e.target.value)} placeholder='Min' className='flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500' />
                            <span className='text-slate-400 text-xs'>—</span>
                            <input type='number' value={filterPriceMax} onChange={e => setFilterPriceMax(e.target.value)} placeholder='Max' className='flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500' />
                          </div>
                        </div>
                        <div>
                          <p className='text-xs font-semibold text-slate-600 mb-1.5'>Gender Restriction</p>
                          <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
                            className='w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'>
                            <option value=''>Any</option>
                            <option value='none'>No Restriction</option>
                            <option value='male'>Male Only</option>
                            <option value='female'>Female Only</option>
                          </select>
                        </div>
                        <div>
                          <p className='text-xs font-semibold text-slate-600 mb-1.5'>Must Have Amenities</p>
                          <div className='flex flex-wrap gap-1.5'>
                            {FILTER_AMENITIES.map(a => (
                              <button key={a} type='button'
                                onClick={() => setFilterAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${filterAmenities.includes(a) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                                {a}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Card>
                    <CardHeader><CardTitle>Properties on Map</CardTitle></CardHeader>
                    <CardContent>
                      <PropertyMap properties={filteredProperties} />
                    </CardContent>
                  </Card>

                  {filteredProperties.length === 0 ? (
                    <Card><CardContent>
                      <div className='text-center py-12'>
                        <p className='text-lg text-slate-600'>No properties found.</p>
                      </div>
                    </CardContent></Card>
                  ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                      {filteredProperties.map(property => {
                        const existingInquiry = myInquiries.find(i => i.propertyId === property.id && !['closed', 'cancelled', 'rejected', 'expired'].includes(i.status))
                        const isFull = !property.rentalTerms && (property.tenants?.length || 0) >= (Number(property.capacity) || 1)
                        return (
                          <div key={property.id} className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow'>
                            <div className='relative'>
                              <PhotoGrid photos={property.photos} onPhotoClick={setLightboxImage} />
                              {isFull && (
                                <div className='absolute top-3 left-3'>
                                  <span className='px-2.5 py-1 bg-rose-600 text-white text-xs font-bold rounded-full shadow-sm'>Full</span>
                                </div>
                              )}
                            </div>

                            <div className='p-4 space-y-3'>
                              <div className='flex items-start justify-between gap-2'>
                                <div>
                                  <p className='text-xl font-bold text-rose-600'>
                                    {priceLabel(property)}
                                  </p>
                                  <div className='flex items-center gap-1.5 mt-0.5 flex-wrap'>
                                    <p className='font-semibold text-slate-900'>{property.title}</p>
                                    {property.landlordVerified && (
                                      <span className='inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full'>
                                        <i className='bi bi-patch-check-fill' /> Verified
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className='text-right shrink-0'>
                                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                                    property.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                    property.score >= 60 ? 'bg-indigo-100 text-indigo-700' :
                                    property.score >= 40 ? 'bg-amber-100 text-amber-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {property.rentalTerms?.occupancy === 'exclusive' ? 'Private room' : property.score == null ? 'No score yet' : `${property.score}% Match`}
                                  </div>
                                </div>
                              </div>

                              {property.location?.address && (
                                <div className='flex items-center gap-1.5 text-slate-500'>
                                  <svg className='w-3.5 h-3.5 shrink-0' fill='currentColor' viewBox='0 0 24 24'>
                                    <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' />
                                  </svg>
                                  <span className='text-sm'>{property.location.address}</span>
                                </div>
                              )}

                              <div className='flex flex-wrap gap-1.5'>
                                {property.propertyType && (
                                  <span className='px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full'>
                                    {property.propertyType}
                                  </span>
                                )}
                                <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${isFull ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                  {property.tenants?.length || 0}/{property.capacity} tenants{isFull ? ' · Full' : ''}
                                </span>
                                <span className='px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full'>
                                  {property.rules?.curfew || 'No Curfew'}
                                </span>
                                {property.rules?.genderRestriction && property.rules.genderRestriction !== 'none' && (
                                  <span className='px-2.5 py-1 bg-rose-100 text-rose-700 text-xs rounded-full capitalize'>
                                    {property.rules.genderRestriction} only
                                  </span>
                                )}
                              </div>

                              {property.description && (
                                <p className='text-sm text-slate-600 line-clamp-2'>{property.description}</p>
                              )}

                              {property.amenities?.length > 0 && (
                                <AmenitiesDisplay amenities={property.amenities} />
                              )}

                              <ViewPermits permits={property.permits} />

                              {existingInquiry ? (
                                <div className='space-y-2 pt-1'>
                                  <div className='flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200'>
                                    <svg className='w-4 h-4 text-emerald-600 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                                    </svg>
                                    <span className='text-sm text-emerald-700 font-medium flex-1'>Inquiry Sent</span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                      existingInquiry.status === 'approved' ? 'bg-emerald-200 text-emerald-800' :
                                      existingInquiry.status === 'active' ? 'bg-indigo-100 text-indigo-700' :
                                      'bg-amber-100 text-amber-700'
                                    }`}>
                                      {existingInquiry.status}
                                    </span>
                                    {existingInquiry.unreadByTenant && (
                                      <span className='w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0 animate-pulse' title='New reply' />
                                    )}
                                  </div>
                                  <div className='flex gap-2'>
                                    <Button variant='secondary' size='sm' className='flex-1' onClick={() => openConversation({ type: 'inquiry', inquiry: existingInquiry })}>
                                      Open Chat
                                    </Button>
                                    {existingInquiry.status !== 'approved' && (
                                      <Button variant='danger' size='sm' onClick={() => handleCancelInquiry(existingInquiry.id)}>
                                        Cancel
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ) : isFull ? (
                                <div className='w-full mt-1 py-2.5 px-4 bg-rose-50 border border-rose-200 rounded-xl text-center'>
                                  <span className='text-sm text-rose-600 font-semibold'><i className='bi bi-person-fill-x mr-1' />Property Full</span>
                                </div>
                              ) : (
                                <Button variant='primary' size='sm' className='w-full mt-1' onClick={() => setContactProperty(property)}>
                                  Contact Landlord
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'applications' && <ApplicationsPanel inquiries={myInquiries} user={user} />}
      {activeTab === 'payments' && <PaymentsPanel user={user} />}
      {/* ── MY HOME ── */}
      {activeTab === 'myhome' && (
        <div className='space-y-6'>
          {!approvedInquiry ? (
            <div className='text-center py-20'>
              <div className='w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4'>
                <i className='bi bi-house-door text-slate-400 text-4xl' />
              </div>
              <p className='text-xl font-semibold text-slate-700'>No approved rental yet</p>
              <p className='text-slate-500 mt-2 text-sm'>Your home appears after your signed contract is accepted and payment is confirmed.</p>
              <Button variant='primary' className='mt-6' onClick={() => setActiveTab('matching')}>
                Browse Properties
              </Button>
            </div>
          ) : !homeProperty ? (
            <div className='text-center py-16 text-slate-500'>Loading your home details...</div>
          ) : (
            <>
              {/* Property card */}
              <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
                <PhotoGrid photos={homeProperty.photos} onPhotoClick={setLightboxImage} />
                <div className='p-5 space-y-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <p className='text-2xl font-bold text-rose-600'>
                        {approvedInquiry.selection ? `₱${approvedInquiry.selection.rate.toLocaleString()} / ${approvedInquiry.selection.period}` : priceLabel(homeProperty)}
                      </p>
                      <p className='text-lg font-semibold text-slate-900 mt-0.5'>{homeProperty.title}</p>
                    </div>
                    {homeProperty.propertyType && (
                      <span className='px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full shrink-0'>
                        {homeProperty.propertyType}
                      </span>
                    )}
                  </div>

                  {homeProperty.location?.address && (
                    <div className='flex items-center gap-1.5 text-slate-500'>
                      <svg className='w-3.5 h-3.5 shrink-0' fill='currentColor' viewBox='0 0 24 24'>
                        <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' />
                      </svg>
                      <span className='text-sm'>{homeProperty.location.address}</span>
                    </div>
                  )}

                  <div className='flex flex-wrap gap-1.5'>
                    <span className='px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full'>
                      {homeProperty.tenants?.length || 0}/{homeProperty.capacity} tenants
                    </span>
                    <span className='px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full'>
                      {homeProperty.rules?.curfew || 'No Curfew'}
                    </span>
                    {homeProperty.rules?.genderRestriction && homeProperty.rules.genderRestriction !== 'none' && (
                      <span className='px-2.5 py-1 bg-rose-100 text-rose-700 text-xs rounded-full capitalize'>
                        {homeProperty.rules.genderRestriction} only
                      </span>
                    )}
                  </div>

                  {homeProperty.description && (
                    <p className='text-sm text-slate-600'>{homeProperty.description}</p>
                  )}

                  {homeProperty.amenities?.length > 0 && (
                    <div className='flex flex-wrap gap-1.5'>
                      {homeProperty.amenities.map(a => (
                        <span key={a} className='px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-full'>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Permits */}
              <ViewPermits permits={homeProperty.permits} />

              {/* Communication buttons */}
              <div className='flex flex-wrap gap-3'>
                <Button variant='primary' onClick={() => openConversation({ type: 'group', propertyId: homeProperty.id, propertyTitle: homeProperty.title })}>
                  <i className='bi bi-people-fill mr-2' /> Group Chat
                </Button>
                <Button variant='secondary' onClick={() => openConversation({ type: 'inquiry', inquiry: approvedInquiry })}>
                  <i className='bi bi-chat-dots mr-2' /> Message Landlord
                </Button>
              </div>

              {/* ── Landlord Contact ── */}
              {(homeProperty.landlordContact?.phone || homeProperty.landlordContact?.email || homeProperty.landlordVerified) && (
                <Card>
                  <CardHeader>
                    <div className='flex items-center gap-2'>
                      <CardTitle>
                        <i className='bi bi-person-badge mr-2 text-indigo-500' />
                        Your Landlord
                      </CardTitle>
                      {homeProperty.landlordVerified && (
                        <span className='flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full'>
                          <i className='bi bi-patch-check-fill text-xs' /> Verified
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-2'>
                    {homeProperty.landlordContact?.phone && (
                      <div className='flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100'>
                        <div className='flex items-center gap-2'>
                          <i className='bi bi-telephone text-slate-400 text-sm' />
                          <span className='text-sm text-slate-600'>Phone</span>
                        </div>
                        <a href={`tel:${homeProperty.landlordContact.phone}`} className='text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors'>
                          {homeProperty.landlordContact.phone}
                        </a>
                      </div>
                    )}
                    {homeProperty.landlordContact?.email && (
                      <div className='flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100'>
                        <div className='flex items-center gap-2'>
                          <i className='bi bi-envelope text-slate-400 text-sm' />
                          <span className='text-sm text-slate-600'>Email</span>
                        </div>
                        <a href={`mailto:${homeProperty.landlordContact.email}`} className='text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors truncate max-w-[60%] text-right'>
                          {homeProperty.landlordContact.email}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── Move-Out Request ── */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <i className='bi bi-box-arrow-right mr-2 text-rose-500' />
                    Move-Out
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {myMoveoutRequest ? (
                    <div className='space-y-3'>
                      <div className='p-3.5 bg-amber-50 border border-amber-200 rounded-xl'>
                        <p className='text-sm font-semibold text-amber-900'>Move-Out Request Pending</p>
                        <p className='text-xs text-amber-700 mt-0.5'>
                          <i className='bi bi-calendar3 mr-1' />Scheduled: <span className='font-bold'>{myMoveoutRequest.moveOutDate}</span>
                        </p>
                        {myMoveoutRequest.reason && (
                          <p className='text-xs text-slate-600 mt-1 italic'>"{myMoveoutRequest.reason}"</p>
                        )}
                        <p className='text-xs text-slate-500 mt-1.5'>Waiting for your landlord to confirm.</p>
                      </div>
                      <Button variant='secondary' size='sm' onClick={handleCancelMoveoutRequest}>
                        Cancel Request
                      </Button>
                    </div>
                  ) : showMoveoutForm ? (
                    <div className='space-y-3'>
                      <div>
                        <Label>Move-Out Date</Label>
                        <Input
                          type='date'
                          value={moveoutDate}
                          onChange={e => setMoveoutDate(e.target.value)}
                          min={new Date().toISOString().slice(0, 10)}
                        />
                      </div>
                      <div>
                        <Label>Reason <span className='text-slate-400 font-normal'>(optional)</span></Label>
                        <textarea
                          value={moveoutReason}
                          onChange={e => setMoveoutReason(e.target.value)}
                          rows={2}
                          placeholder='e.g. Moving to another city, found a closer place...'
                          className='w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none'
                        />
                      </div>
                      <div className='flex gap-2'>
                        <Button variant='secondary' className='flex-1' onClick={() => { setShowMoveoutForm(false); setMoveoutDate(''); setMoveoutReason('') }}>
                          Cancel
                        </Button>
                        <Button variant='danger' className='flex-1' onClick={handleRequestMoveout} disabled={!moveoutDate || moveoutSaving}>
                          {moveoutSaving ? 'Submitting...' : 'Submit Request'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className='flex items-center justify-between gap-4'>
                      <p className='text-sm text-slate-500'>Planning to leave? Submit a move-out request and your landlord will confirm it.</p>
                      <Button variant='danger' size='sm' className='shrink-0' onClick={() => setShowMoveoutForm(true)}>
                        Request Move-Out
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Housemates */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Housemates ({Math.max(0, (homeProperty.tenants?.length || 0) - 1)})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(homeProperty.tenants || []).filter(uid => uid !== user.uid).length === 0 ? (
                    <p className='text-sm text-slate-500'>You're the only tenant here so far.</p>
                  ) : (
                    <div className='space-y-3'>
                      {(homeProperty.tenants || [])
                        .filter(uid => uid !== user.uid)
                        .map(uid => {
                          const t = homeProperty.tenantDetails?.[uid]
                          const name = t?.name || 'Tenant'
                          return (
                            <div key={uid} className='flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100'>
                              <div className='flex items-center gap-3 min-w-0'>
                                <div className='w-10 h-10 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center text-base font-bold text-indigo-600 shrink-0'>
                                  {t?.profilePhoto
                                    ? <img src={t.profilePhoto} alt='' className='w-full h-full object-cover' />
                                    : name.charAt(0).toUpperCase()
                                  }
                                </div>
                                <div className='min-w-0'>
                                  <p className='font-medium text-slate-900 truncate'>{name}</p>


                                </div>
                              </div>
                              <div className='flex gap-2 shrink-0'>
                                <button
                                  type='button'
                                  onClick={() => setViewingTenant({ uid, name })}
                                  className='text-xs text-indigo-600 font-semibold hover:text-indigo-800 px-2.5 py-1.5 bg-white rounded-lg border border-indigo-200 hover:border-indigo-400 transition-colors whitespace-nowrap'
                                >
                                  Housemate
                                </button>
                                <button
                                  type='button'
                                  onClick={() => openConversation({ type: 'dm', otherUser: { uid, name } })}
                                  className='text-xs text-slate-600 font-semibold hover:text-slate-900 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 hover:border-slate-400 transition-colors'
                                >
                                  Message
                                </button>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Maintenance Requests ── */}
              <Card>
                <CardHeader>
                  <div className='flex items-center justify-between'>
                    <CardTitle>
                      <i className='bi bi-tools mr-2 text-amber-500' />
                      Maintenance Requests
                    </CardTitle>
                    {!showMaintenanceForm && (
                      <button type='button' onClick={() => setShowMaintenanceForm(true)}
                        className='text-xs text-indigo-600 font-semibold hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-200 transition-colors'>
                        <i className='bi bi-plus-lg mr-1' />New Request
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {showMaintenanceForm && (
                    <div className='space-y-3 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl'>
                      <p className='text-sm font-semibold text-amber-900'>New Maintenance Request</p>
                      <div>
                        <Label>Issue Title</Label>
                        <input value={maintenanceTitle} onChange={e => setMaintenanceTitle(e.target.value)} placeholder='e.g. Leaking faucet, broken window lock...'
                          className='w-full mt-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30' />
                      </div>
                      <div>
                        <Label>Description <span className='text-slate-400 font-normal'>(optional)</span></Label>
                        <textarea value={maintenanceDesc} onChange={e => setMaintenanceDesc(e.target.value)} rows={2}
                          placeholder='Describe the issue in more detail...'
                          className='w-full mt-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none' />
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <div className='flex gap-2 mt-1'>
                          {[['low', 'Low'], ['medium', 'Medium'], ['high', 'High — Urgent']].map(([val, label]) => (
                            <button key={val} type='button' onClick={() => setMaintenancePriority(val)}
                              className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${maintenancePriority === val ? val === 'high' ? 'border-rose-500 bg-rose-50 text-rose-700' : val === 'medium' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-400 bg-slate-50 text-slate-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className='flex gap-2'>
                        <button type='button' onClick={() => { setShowMaintenanceForm(false); setMaintenanceTitle(''); setMaintenanceDesc(''); setMaintenancePriority('medium') }}
                          className='flex-1 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 transition-colors'>Cancel</button>
                        <button type='button' onClick={handleSubmitMaintenance} disabled={!maintenanceTitle.trim() || maintenanceSaving}
                          className='flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors'>
                          {maintenanceSaving ? 'Submitting...' : 'Submit Request'}
                        </button>
                      </div>
                    </div>
                  )}
                  {maintenanceRequests.length === 0 && !showMaintenanceForm ? (
                    <p className='text-sm text-slate-500'>No maintenance requests yet. Click "New Request" to report an issue.</p>
                  ) : (
                    <div className='space-y-3'>
                      {maintenanceRequests.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(req => {
                        const priCfg = PRIORITY_CFG[req.priority] || PRIORITY_CFG.medium
                        const statCfg = MAINT_STATUS[req.status] || MAINT_STATUS.open
                        return (
                          <div key={req.id} className={`p-3.5 rounded-2xl border ${req.status === 'resolved' ? 'bg-emerald-50 border-emerald-100' : req.priority === 'high' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                            <div className='flex items-start justify-between gap-3'>
                              <div className='min-w-0'>
                                <div className='flex items-center gap-2 flex-wrap'>
                                  <p className={`font-semibold text-sm ${req.status === 'resolved' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{req.title}</p>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priCfg.cls}`}>{priCfg.label}</span>
                                </div>
                                <p className='text-xs text-slate-500'>Requested: {formatDate(req.createdAt)} · Started: {formatDate(req.startedAt)} · Resolved: {formatDate(req.resolvedAt)}</p>
                              {req.description && <p className='text-xs text-slate-500 mt-0.5 leading-relaxed'>{req.description}</p>}
                              </div>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${statCfg.cls}`}>{statCfg.label}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Announcements ── */}
              {(announcements.length > 0 || true) && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <i className='bi bi-megaphone-fill mr-2 text-indigo-500' />
                      Announcements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {announcements.length === 0 ? (
                      <p className='text-sm text-slate-500'>No announcements from your landlord yet.</p>
                    ) : (
                      <div className='space-y-3'>
                        {announcements
                          .slice()
                          .sort((a, b) => {
                            if (a.pinned && !b.pinned) return -1
                            if (!a.pinned && b.pinned) return 1
                            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
                          })
                          .map(ann => (
                            <div key={ann.id} className={`p-4 rounded-2xl border ${ann.pinned ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                              <div className='flex items-start gap-2'>
                                {ann.pinned && <i className='bi bi-pin-fill text-indigo-500 text-xs mt-0.5 shrink-0' />}
                                <div className='flex-1 min-w-0'>
                                  <p className={`font-semibold text-sm ${ann.pinned ? 'text-indigo-900' : 'text-slate-900'}`}>{ann.title}</p>
                                  {ann.body && <p className='text-xs text-slate-600 mt-1 leading-relaxed'>{ann.body}</p>}
                                </div>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── House Rules ── */}
              {(homeProperty.houseRules || (homeProperty.emergencyContacts?.length > 0)) && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <i className='bi bi-shield-check mr-2 text-teal-500' />
                      House Rules & Emergency Contacts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    {homeProperty.houseRules && (
                      <div>
                        <p className='text-xs font-bold text-slate-500 uppercase tracking-wide mb-2'>House Rules</p>
                        <p className='text-sm text-slate-700 leading-relaxed whitespace-pre-line'>{homeProperty.houseRules}</p>
                      </div>
                    )}
                    {homeProperty.emergencyContacts?.length > 0 && (
                      <div>
                        <p className='text-xs font-bold text-slate-500 uppercase tracking-wide mb-2'>Emergency Contacts</p>
                        <div className='space-y-2'>
                          {homeProperty.emergencyContacts.map((c, i) => (
                            <div key={i} className='flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100'>
                              <span className='text-sm font-medium text-slate-700'>{c.label}</span>
                              <a href={`tel:${c.number}`} className='text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors'>
                                <i className='bi bi-telephone-fill mr-1' />{c.number}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── PROFILE ── */}
      {activeTab === 'profile' && (
        <div className='max-w-xl space-y-6'>
          <Card>
            <CardHeader><CardTitle>Profile Photo</CardTitle></CardHeader>
            <CardContent>
              <div className='flex items-center gap-6'>
                <div className='w-20 h-20 rounded-full overflow-hidden bg-indigo-100 border-2 border-indigo-200 shrink-0'>
                  {profilePhoto
                    ? <img src={profilePhoto} alt='Profile' className='w-full h-full object-cover' />
                    : <div className='w-full h-full flex items-center justify-center text-2xl font-bold text-indigo-600'>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                  }
                </div>
                <div>
                  <label className='cursor-pointer'>
                    <span className='px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors'>
                      {photoUploading ? 'Uploading...' : 'Upload Photo'}
                    </span>
                    <input type='file' accept='image/*' className='hidden' onChange={handleProfilePhotoUpload} disabled={photoUploading} />
                  </label>
                  <p className='text-xs text-slate-500 mt-2'>JPG, PNG — auto-compressed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {(() => {
            const fields = [
              { key: 'Photo', done: !!profilePhoto },
              { key: 'Full Name', done: !!profileName },
              { key: 'Gender', done: !!gender },
              { key: 'Age', done: !!age },
              { key: 'Occupation', done: !!occupation },
              { key: 'Bio', done: !!bio },
              { key: 'Phone', done: !!profilePhone },
              { key: 'Valid ID', done: !!validIdUrl },
            ]
            const done = fields.filter(f => f.done).length
            const pct = Math.round((done / fields.length) * 100)
            const missing = fields.filter(f => !f.done)
            return (
              <div className={`p-4 rounded-2xl border ${pct === 100 ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className='flex items-center justify-between mb-2'>
                  <p className={`text-sm font-bold ${pct === 100 ? 'text-emerald-800' : 'text-indigo-900'}`}>
                    {pct === 100 ? 'Profile Complete!' : `Profile ${pct}% complete`}
                  </p>
                  <span className={`text-xs font-semibold ${pct === 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>{done}/{fields.length}</span>
                </div>
                <div className='w-full bg-slate-200 rounded-full h-1.5 mb-2'>
                  <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                </div>
                {missing.length > 0 && (
                  <p className='text-xs text-indigo-700'>Missing: {missing.map(f => f.key).join(', ')}</p>
                )}
              </div>
            )
          })()}

          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <Label>Full Name</Label>
                <Input value={profileName} onChange={e => setProfileName(e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user.email} disabled className='opacity-60 cursor-not-allowed' />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input type='tel' value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder='e.g. 09123456789' />
              </div>

              <div>
                <Label>Gender</Label>
                <div className='flex gap-2 mt-1'>
                  {['Male', 'Female'].map(g => (
                    <button
                      key={g}
                      type='button'
                      onClick={() => setGender(g.toLowerCase())}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                        gender === g.toLowerCase()
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Age</Label>
                <Input type='number' min='16' max='100' value={age} onChange={e => setAge(e.target.value)} placeholder='e.g. 22' />
              </div>

              <div>
                <Label>Occupation</Label>
                <select
                  value={occupation}
                  onChange={e => setOccupation(e.target.value)}
                  className='w-full mt-1 px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
                >
                  <option value=''>Select occupation...</option>
                  {OCCUPATIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <div>
                <Label>About Me</Label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={3}
                  placeholder='Tell landlords a bit about yourself...'
                  className='w-full mt-1 px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none'
                />
              </div>

              {profileMsg && (
                <p className={`text-sm ${profileMsg.toLowerCase().includes('fail') || profileMsg.toLowerCase().includes('error') ? 'text-red-600' : 'text-emerald-600'}`}>
                  {profileMsg}
                </p>
              )}
              <Button onClick={handleSaveProfile} variant='primary' disabled={profileSaving}>
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Valid ID</CardTitle></CardHeader>
            <CardContent className='space-y-3'>
              <p className='text-sm text-slate-600'>
                Upload a government-issued ID for identity verification. Landlords may request this before approving your application.
              </p>
              {validIdUrl && (
                <div className='rounded-lg overflow-hidden border border-slate-200'>
                  <img src={validIdUrl} alt='Valid ID' className='w-full object-cover max-h-48' />
                </div>
              )}
              <label className='cursor-pointer block'>
                <span className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${idUploading ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                  {idUploading ? 'Uploading...' : validIdUrl ? 'Replace ID' : 'Upload Valid ID'}
                </span>
                <input type='file' accept='image/*,.pdf' className='hidden' onChange={handleValidIdUpload} disabled={idUploading} />
              </label>
              <p className='text-xs text-slate-400'>Accepted: JPG, PNG, PDF</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
            <CardContent className='space-y-3'>
              <div>
                <Label>Current Password</Label>
                <Input type='password' value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} placeholder='Enter current password' />
              </div>
              <div>
                <Label>New Password</Label>
                <Input type='password' value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder='At least 6 characters' />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input type='password' value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder='Repeat new password' />
              </div>
              {pwMsg && <p className={`text-sm ${pwMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{pwMsg}</p>}
              <Button onClick={handleChangePassword} variant='primary'>Update Password</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Button onClick={logout} variant='danger' className='w-full'>Sign Out</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modals */}
      {contactProperty && (
        <ContactModal
          property={contactProperty}
          tenant={user}
          onSent={(inquiry) => {
            setContactProperty(null)
            openConversation({ type: 'inquiry', inquiry })
          }}
          onClose={() => setContactProperty(null)}
        />
      )}
      {viewingTenant && (
        <TenantDetailModal
          tenantUid={viewingTenant.uid}
          tenantName={viewingTenant.name}
          onClose={() => setViewingTenant(null)}
        />
      )}
      <ConfirmModal dialog={dialog} onClose={() => setDialog(null)} />

      {/* Photo lightbox */}
      {lightboxImage && (
        <div
          className='fixed inset-0 z-[60] bg-black/92 flex items-center justify-center p-4'
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt='Full size'
            className='max-w-full max-h-full object-contain rounded-xl'
          />
          <button
            className='absolute top-4 right-4 text-white text-4xl font-light leading-none hover:text-slate-300'
            onClick={() => setLightboxImage(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
