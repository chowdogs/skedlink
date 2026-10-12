import { RentalTermsFields } from '../components/property/RentalTermsFields'
import { exportReport } from '../../lib/exportReport'
import { ApplicationsPanel } from '../components/property/ApplicationsPanel'
import { PaymentsPanel, useRecords } from '../components/billing/PaymentsPanel'
import { SubscriptionPanel } from '../components/billing/SubscriptionPanel'
import { DEFAULT_TERMS, priceLabel, formatDate, listingLimit } from '../../lib/rentalTerms'
import { platform } from '../../lib/platform'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Input, Label } from '../ui/Input'
import { LocationPicker } from '../components/map/LocationPicker'
import { ImageUploader } from '../components/map/ImageUploader'
import { EditPropertyModal } from '../components/property/EditPropertyModal'
import { TenantDetailModal } from '../components/property/TenantDetailModal'
import { PermitUploader } from '../components/property/PermitUploader'
import { PostBillModal } from '../components/billing/PostBillModal'
import { useMessages } from '../../contexts/MessagesContext'
import { ConfirmModal } from '../ui/ConfirmModal'
import {
  collection, query, where, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { compressToBase64 } from '../../lib/compressToBase64'
import { notify } from '../../lib/notify'


const PROPERTY_TYPES = ['Condo/Apartment', 'Studio', 'Room', 'House', 'Townhouse']
const AMENITIES = [
  'Parking', 'Pool', 'Gym', 'WiFi', 'Aircon',
  'Balcony', 'Elevator', 'Security', 'Laundry', 'Pets Allowed',
  'Kitchen', 'Water Heater', 'Refrigerator', 'CCTV', 'TV/Cable',
  'Generator', 'Near Transport'
]

const EMPTY_FORM = {
  title: '', description: '', price: '', capacity: '',
  propertyType: '', amenities: [],
  curfewEnabled: false, curfew: '',
  genderRestriction: 'none', photos: [], location: null,
  rentalTerms: DEFAULT_TERMS, permits: {}, houseRules: '', emergencyContacts: []
}

const STATUS_BADGE = { pending: 'warning', active: 'primary', approved: 'success', closed: 'danger' }

const Toggle = ({ on, onToggle, labelOn, labelOff }) => (
  <div className='flex items-center gap-3'>
    <button
      type='button'
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
    <span className='text-sm text-slate-600'>{on ? labelOn : labelOff}</span>
  </div>
)

const PhotoGrid = ({ photos, onPhotoClick }) => {
  if (!photos || photos.length === 0) {
    return (
      <div className='h-52 bg-slate-100 flex items-center justify-center'>
        <p className='text-slate-400 text-sm'>No photos added</p>
      </div>
    )
  }
  if (photos.length === 1) {
    return (
      <img src={photos[0]} alt='' className='w-full h-52 object-cover cursor-pointer hover:opacity-95 transition-opacity' onClick={() => onPhotoClick(photos[0])} />
    )
  }
  return (
    <div className='grid h-52' style={{ gridTemplateColumns: '2fr 1fr' }}>
      <img src={photos[0]} alt='' className='w-full h-52 object-cover cursor-pointer hover:opacity-95 transition-opacity border-r border-white border-r-2' onClick={() => onPhotoClick(photos[0])} />
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

export const OwnerDashboard = ({ user }) => {
  const { updateUserProfile, changePassword, logout } = useAuth()
  const { openConversation } = useMessages()
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).has('checkout') ? 'payments' : window.sessionStorage.getItem('skedlink:onboarding-plan') ? 'plans' : 'overview')
  const [properties, setProperties] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [bills, setBills] = useState([])
  const [payments, setPayments] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProperty, setEditingProperty] = useState(null)
  const [viewingTenant, setViewingTenant] = useState(null)
  const [lightboxImage, setLightboxImage] = useState(null)
  const [showPostBill, setShowPostBill] = useState(false)
  const [maintenanceCharge, setMaintenanceCharge] = useState(null)
  const [subscriptions] = useRecords('subscriptions', 'landlordUid', user.uid)
  const premium = listingLimit(subscriptions[0]) > 1
  useEffect(() => { window.sessionStorage.removeItem('skedlink:onboarding-plan') }, [])
  const [moveoutRequests, setMoveoutRequests] = useState([])
  const [maintenanceRequests, setMaintenanceRequests] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [postingAnnFor, setPostingAnnFor] = useState(null)
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')
  const [annPinned, setAnnPinned] = useState(false)
  const [annSaving, setAnnSaving] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  useEffect(() => { const navigate = e => setActiveTab(e.detail.tab); window.addEventListener('skedlink:navigate', navigate); return () => window.removeEventListener('skedlink:navigate', navigate) }, [])

  // Profile state
  const [profilePhoto, setProfilePhoto] = useState(user.profilePhoto || '')
  const [profileName, setProfileName] = useState(user.fullName || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [profileBio, setProfileBio] = useState(user.bio || '')
  const [profilePhone, setProfilePhone] = useState(user.phone || '')
  const [govIdDoc, setGovIdDoc] = useState(user.verificationDocs?.govId || null)
  const [ownerProofDoc, setOwnerProofDoc] = useState(user.verificationDocs?.ownershipProof || null)
  const [verifyingGovId, setVerifyingGovId] = useState(false)
  const [verifyingOwnerProof, setVerifyingOwnerProof] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'properties'), where('ownerId', '==', user.uid))
    return onSnapshot(q, (snap) => setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'inquiries'), where('landlordUid', '==', user.uid))
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setInquiries(list)
    })
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'bills'), where('landlordUid', '==', user.uid))
    return onSnapshot(q, snap => setBills(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'payments'), where('landlordUid', '==', user.uid))
    return onSnapshot(q, snap => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'moveoutRequests'), where('landlordUid', '==', user.uid))
    return onSnapshot(q, snap => setMoveoutRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'maintenanceRequests'), where('landlordUid', '==', user.uid))
    return onSnapshot(q, snap => setMaintenanceRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'announcements'), where('landlordUid', '==', user.uid))
    return onSnapshot(q, snap => setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [user.uid])

  const totalCapacity = properties.reduce((s, p) => s + (Number(p.capacity) || 0), 0)
  const occupiedSlots = properties.reduce((s, p) => s + (p.tenants?.length || 0), 0)
  const set = (key) => (e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))

  const toggleAmenity = (a) =>
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter(x => x !== a)
        : [...prev.amenities, a]
    }))

  const handleAdd = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!formData.location) { setFormError('Please pin the property location on the map.'); return }
    setSaving(true)
    try {
      await platform('saveProperty', { property: { ...formData, rules: { curfewEnabled: formData.curfewEnabled, curfew: formData.curfewEnabled ? formData.curfew : 'No Curfew', genderRestriction: formData.genderRestriction } } })
      setFormData(EMPTY_FORM)
      setShowAddForm(false)
    } catch (err) {
      setFormError('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (propertyId) => {
    setDialog({
      title: 'Delete Property',
      message: 'This cannot be undone. The property listing will be permanently removed.',
      variant: 'danger',
      icon: 'bi-building-fill-x',
      confirmLabel: 'Delete Property',
      onConfirm: async () => { await platform('deleteProperty', { id: propertyId }) },
    })
  }

  const handleApprove = () => setActiveTab('applications')

  const evictTenant = async (propertyId, propertyTitle, tenantUid, tenantName, moveoutReqId = null) => {
    await platform('removeTenant', { propertyId, tenantUid, moveoutReqId })
  }

  const handleRemoveTenant = (property, tenantUid, tenantName) => {
    setDialog({
      title: 'Remove Tenant',
      message: `${tenantName} will be immediately removed from "${property.title}" and notified.`,
      hasInput: true,
      inputLabel: 'Reason for tenant (optional)',
      inputPlaceholder: 'e.g. Lease violation, end of contract…',
      variant: 'danger',
      icon: 'bi-person-dash-fill',
      confirmLabel: 'Remove Tenant',
      onConfirm: async (reason) => {
        const mo = moveoutRequests.find(r => r.tenantUid === tenantUid && r.propertyId === property.id && r.status === 'pending')
        await evictTenant(property.id, property.title, tenantUid, tenantName, mo?.id)
        await notify(tenantUid, {
          type: 'moveout',
          title: 'Removed from Property',
          body: reason
            ? `You have been removed from "${property.title}". Reason: ${reason}`
            : `You have been removed from "${property.title}" by your landlord.`,
          tab: 'myhome',
        })
      },
    })
  }

  const handleConfirmMoveout = (req, property) => {
    setDialog({
      title: 'Confirm Move-Out',
      message: `Confirm ${req.tenantName}'s move-out on ${req.moveOutDate}? They will be removed from "${property.title}" and notified.`,
      variant: 'danger',
      icon: 'bi-box-arrow-right',
      confirmLabel: 'Confirm & Remove',
      onConfirm: async () => {
        await evictTenant(property.id, property.title, req.tenantUid, req.tenantName, req.id)
        await notify(req.tenantUid, {
          type: 'moveout',
          title: 'Move-Out Confirmed',
          body: `Your move-out from "${property.title}" on ${req.moveOutDate} has been confirmed by your landlord.`,
          tab: 'myhome',
        })
      },
    })
  }

  const handleMaintenanceStatus = async (req, newStatus) => {
    try {
      await platform('maintenanceStatus', { id: req.id, status: newStatus })
      const statusLabel = newStatus === 'in_progress' ? 'is being worked on' : 'has been resolved'
      await notify(req.tenantUid, {
        type: 'default',
        title: `Maintenance Update: ${req.title}`,
        body: `Your maintenance request "${req.title}" ${statusLabel}.`,
        tab: 'myhome',
      })
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const handlePostAnnouncement = async (propertyId, propertyTitle) => {
    if (!annTitle.trim()) return
    setAnnSaving(true)
    try {
      await addDoc(collection(db, 'announcements'), {
        propertyId,
        propertyTitle,
        landlordUid: user.uid,
        title: annTitle.trim(),
        body: annBody.trim(),
        pinned: annPinned,
        createdAt: serverTimestamp(),
      })
      const property = properties.find(p => p.id === propertyId)
      const tenantUids = property?.tenants || []
      for (const tUid of tenantUids) {
        await notify(tUid, {
          type: 'default',
          title: annPinned ? `📌 ${annTitle.trim()}` : annTitle.trim(),
          body: annBody.trim() || 'Your landlord posted a new announcement.',
          tab: 'myhome',
        })
      }
      setAnnTitle('')
      setAnnBody('')
      setAnnPinned(false)
      setPostingAnnFor(null)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setAnnSaving(false)
    }
  }

  const handleDeleteAnnouncement = (annId) => {
    setDialog({
      title: 'Delete Announcement',
      message: 'This announcement will be permanently removed.',
      variant: 'danger',
      icon: 'bi-megaphone',
      confirmLabel: 'Delete',
      onConfirm: async () => { await deleteDoc(doc(db, 'announcements', annId)) },
    })
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

  const landlordIsVerified = user.isVerified === true

  const handleUploadVerificationDoc = async (e, docKey) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (docKey === 'govId') setVerifyingGovId(true)
    else setVerifyingOwnerProof(true)
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const docData = { data: dataUrl, fileName: file.name }
      const updates = { [`verificationDocs.${docKey}`]: docData }
      await updateUserProfile(updates)
      if (docKey === 'govId') setGovIdDoc(docData)
      else setOwnerProofDoc(docData)
      setProfileMsg('Document uploaded. Verification requires review.')
      setTimeout(() => setProfileMsg(''), 4000)
    } catch (err) {
      setProfileMsg('Upload failed: ' + err.message)
    } finally {
      if (docKey === 'govId') setVerifyingGovId(false)
      else setVerifyingOwnerProof(false)
    }
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    setProfileMsg('')
    try {
      await updateUserProfile({ fullName: profileName, bio: profileBio, phone: profilePhone })
      const contactUpdate = { landlordContact: { phone: profilePhone, email: user.email } }
      for (const property of properties) {
        try { await updateDoc(doc(db, 'properties', property.id), contactUpdate) } catch {}
      }
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
      setPwMsg('Password changed successfully!')
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setTimeout(() => setPwMsg(''), 4000)
    } catch (err) {
      setPwMsg('Error: ' + err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim())
    }
  }

  // Analytics — only bills marked isRevenue count toward the landlord's income
  const revenueBillIds = new Set(bills.filter(b => b.isRevenue).map(b => b.id))
  const paidPayments = payments.filter(p => p.status === 'paid')
  const paidRevenuePayments = paidPayments.filter(p => p.revenueAmount > 0 || revenueBillIds.has(p.billId))
  const totalRevenue = paidRevenuePayments.reduce((s, p) => s + Number(p.revenueAmount ?? p.amount ?? 0), 0)
  const estMonthlyRent = inquiries.filter(i => i.status === 'approved' && i.selection?.period === 'month').reduce((s, i) => s + Number(i.selection.rate), 0)
  const pendingAmount = payments
    .filter(p => p.status === 'under_review' && revenueBillIds.has(p.billId))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0)

  // Revenue by month (from paid revenue payments joined with their bills)
  const revenueByMonth = paidRevenuePayments.reduce((acc, p) => {
    const bill = bills.find(b => b.id === p.billId)
    const m = bill?.month || 'Unknown'
    acc[m] = (acc[m] || 0) + Number(p.revenueAmount ?? p.amount ?? 0)
    return acc
  }, {})

  const displayName = user.fullName || user.name || 'Landlord'
  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'properties', label: 'Properties' },
    { id: 'applications', label: 'Applications' },
    { id: 'payments', label: 'Payments' },
    { id: 'plans', label: 'Plans' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'profile', label: 'My Profile' }
  ]
  const openMaintenanceCount = maintenanceRequests.filter(r => r.status === 'open').length

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 py-8'>
      {/* Welcome Banner */}
      <div className='mb-8 rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-violet-700 px-8 py-7 relative overflow-hidden'>
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute -top-8 -right-8 w-48 h-48 bg-white/10 rounded-full blur-2xl' />
          <div className='absolute bottom-0 left-1/3 w-32 h-32 bg-indigo-400/20 rounded-full blur-xl' />
        </div>
        <div className='relative'>
          <p className='text-indigo-200 text-sm font-medium mb-1'>Property Management</p>
          <h1 className='text-3xl font-bold text-white' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Welcome, {displayName}!
          </h1>
          <div className='flex items-center gap-3 mt-1'>
            <p className='text-indigo-100 text-sm'>Landlord Dashboard</p>
            {landlordIsVerified && (
              <span className='inline-flex items-center gap-1.5 px-3 py-0.5 bg-white/15 rounded-full text-white text-xs font-semibold'>
                <i className='bi bi-patch-check-fill text-emerald-300' /> Verified Landlord
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className='flex gap-1 mb-8 bg-slate-100 rounded-2xl p-1.5 overflow-x-auto'>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative px-5 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}>
            {tab.label}
            {tab.id === 'properties' && moveoutRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className='absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center'>
                {moveoutRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
            {tab.id === 'maintenance' && openMaintenanceCount > 0 && (
              <span className='absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center'>
                {openMaintenanceCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'applications' && <ApplicationsPanel inquiries={inquiries} user={user} landlord />}
      {activeTab === 'payments' && <div className='space-y-4'><Button onClick={() => setShowPostBill(true)}>Post a charge</Button><PaymentsPanel user={user} landlord /></div>}
      {activeTab === 'plans' && <SubscriptionPanel user={user} properties={properties} />}
      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className='space-y-6'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            {[
              { icon: 'bi-building', label: 'Properties', value: properties.length, grad: 'from-indigo-500 to-violet-500' },
              { icon: 'bi-person-check', label: 'Occupied Slots', value: occupiedSlots, grad: 'from-emerald-500 to-teal-500' },
              { icon: 'bi-door-open', label: 'Available Slots', value: totalCapacity - occupiedSlots, grad: 'from-amber-500 to-orange-500' },
              { icon: 'bi-envelope', label: 'New Inquiries', value: inquiries.filter(i => i.status === 'pending').length, grad: 'from-rose-500 to-pink-500' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className='flex items-center gap-4'>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center shrink-0 shadow-md`}>
                    <i className={`bi ${s.icon} text-white text-lg`} />
                  </div>
                  <div>
                    <p className='text-2xl font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</p>
                    <p className='text-xs text-slate-500'>{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>Tenant Inquiries</CardTitle></CardHeader>
            <CardContent>
              {inquiries.length === 0 ? (
                <p className='text-sm text-slate-500'>No inquiries yet.</p>
              ) : (
                <div className='space-y-3'>
                  {inquiries.map(inq => (
                    <div key={inq.id} className={`p-4 rounded-xl border ${inq.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0 flex-1'>
                          <div className='flex items-center gap-2'>
                            <p className='font-medium text-slate-900'>{inq.tenantName}</p>
                            {inq.unreadByOwner && <span className='w-2 h-2 rounded-full bg-indigo-600 shrink-0' />}
                          </div>
                          <p className='text-xs text-slate-500'>{inq.tenantEmail}{inq.tenantPhone ? ` · ${inq.tenantPhone}` : ''}</p>
                          <p className='text-sm text-slate-700 mt-1'>
                            <span className='font-medium'>{inq.type === 'rent' ? 'Wants to rent' : 'Wants to visit'}</span>
                            {' — '}{inq.propertyTitle}
                          </p>
                          {inq.message && <p className='text-sm text-slate-600 mt-1 italic'>"{inq.message}"</p>}
                        </div>
                        <div className='flex flex-col items-end gap-2 shrink-0'>
                          <Badge variant={STATUS_BADGE[inq.status] || 'warning'}>{inq.status}</Badge>
                          <button type='button' onClick={() => openConversation({ type: 'inquiry', inquiry: inq })} className='text-sm text-indigo-600 font-medium hover:text-indigo-800 whitespace-nowrap'>
                            {inq.status === 'pending' ? 'Reply →' : 'Open Chat →'}
                          </button>
                          {inq.type === 'rent' && inq.status !== 'approved' && (
                            <button type='button' onClick={() => handleApprove(inq)} className='text-sm text-emerald-600 font-medium hover:text-emerald-800 whitespace-nowrap'>
                              Manage application →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── PROPERTIES ── */}
      {activeTab === 'properties' && (
        <div className='space-y-6'>
          <div className='flex justify-end'>
            <Button variant={showAddForm ? 'secondary' : 'primary'} onClick={() => { setShowAddForm(v => !v); setFormError('') }}>
              {showAddForm ? 'Cancel' : '+ Add Property'}
            </Button>
          </div>

          {showAddForm && (
            <Card>
              <CardHeader><CardTitle>New Property</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleAdd} className='space-y-5'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='md:col-span-2'>
                      <Label>Property Title</Label>
                      <Input placeholder='Sunrise Dorm' value={formData.title} onChange={set('title')} required />
                    </div>
                    <div className='md:col-span-2'>
                      <Label>Description</Label>
                      <textarea value={formData.description} onChange={set('description')} rows={3} placeholder='Describe your property...' className='w-full px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none' />
                    </div>
                    <div>
                      <Label>Whole-room rate (₱)</Label>
                      <Input type='number' min='0' placeholder='5000' value={formData.price} onChange={set('price')} required />
                    </div>
                    <div>
                      <Label>Capacity (max tenants)</Label>
                      <Input type='number' min='1' placeholder='4' value={formData.capacity} onChange={set('capacity')} required />
                    </div>
                    <div className='md:col-span-2'>
                      <Label>Property Type</Label>
                      <div className='flex flex-wrap gap-2 mt-2'>
                        {PROPERTY_TYPES.map(type => (
                          <button key={type} type='button' onClick={() => setFormData(prev => ({ ...prev, propertyType: prev.propertyType === type ? '' : type }))}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${formData.propertyType === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300'}`}>
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Curfew</Label>
                      <div className='mt-1'>
                        <Toggle on={formData.curfewEnabled} onToggle={() => setFormData(prev => ({ ...prev, curfewEnabled: !prev.curfewEnabled }))} labelOn='Enabled' labelOff='No Curfew' />
                        {formData.curfewEnabled && <Input className='mt-2' placeholder='e.g. 10:00 PM' value={formData.curfew} onChange={set('curfew')} />}
                      </div>
                    </div>
                    <div>
                      <Label>Gender Restriction</Label>
                      <select value={formData.genderRestriction} onChange={set('genderRestriction')} className='w-full mt-1 px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500'>
                        <option value='none'>No Restriction</option>
                        <option value='male'>Male Only</option>
                        <option value='female'>Female Only</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label>Amenities</Label>
                    <div className='flex flex-wrap gap-2 mt-2'>
                      {AMENITIES.map(a => (
                        <button key={a} type='button' onClick={() => toggleAmenity(a)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${formData.amenities.includes(a) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300'}`}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>House Rules</Label>
                    <textarea value={formData.houseRules} onChange={set('houseRules')} rows={3}
                      placeholder='e.g. No smoking inside, no loud music after 10pm, keep common areas clean...'
                      className='w-full mt-1 px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none' />
                  </div>
                  <div>
                    <Label>Emergency Contacts</Label>
                    <div className='space-y-2 mt-1'>
                      {formData.emergencyContacts.map((c, i) => (
                        <div key={i} className='flex gap-2'>
                          <input placeholder='Label (e.g. Landlord, Fire Dept)' value={c.label}
                            onChange={e => { const contacts = [...formData.emergencyContacts]; contacts[i] = { ...contacts[i], label: e.target.value }; setFormData(prev => ({ ...prev, emergencyContacts: contacts })) }}
                            className='flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500' />
                          <input placeholder='Number' value={c.number}
                            onChange={e => { const contacts = [...formData.emergencyContacts]; contacts[i] = { ...contacts[i], number: e.target.value }; setFormData(prev => ({ ...prev, emergencyContacts: contacts })) }}
                            className='w-40 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500' />
                          <button type='button' onClick={() => setFormData(prev => ({ ...prev, emergencyContacts: prev.emergencyContacts.filter((_, j) => j !== i) }))}
                            className='text-slate-400 hover:text-rose-500 transition-colors px-2'><i className='bi bi-x-circle' /></button>
                        </div>
                      ))}
                      <button type='button'
                        onClick={() => setFormData(prev => ({ ...prev, emergencyContacts: [...prev.emergencyContacts, { label: '', number: '' }] }))}
                        className='text-xs text-indigo-600 font-semibold hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-200 transition-colors'>
                        <i className='bi bi-plus-lg mr-1' />Add Contact
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>Property Photos</Label>
                    <ImageUploader value={formData.photos} onChange={(photos) => setFormData(prev => ({ ...prev, photos }))} />
                  </div>
                  <div>
                    <PermitUploader
                      value={formData.permits}
                      onChange={(permits) => setFormData(prev => ({ ...prev, permits }))}
                    />
                  </div>
                  <div>
                    <Label>Property Location</Label>
                    <p className='text-xs text-slate-500 mb-2'>Search or click the map to pin the location.</p>
                    <LocationPicker value={formData.location} onChange={(loc) => setFormData(prev => ({ ...prev, location: loc }))} />
                  </div>
                  <RentalTermsFields value={formData.rentalTerms} onChange={rentalTerms => setFormData(prev => ({ ...prev, rentalTerms }))} price={formData.price} capacity={formData.capacity} />
                  {formError && <p className='text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg'>{formError}</p>}
                  <Button type='submit' variant='primary' disabled={saving}>{saving ? 'Saving...' : 'Add Property'}</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {properties.length === 0 && !showAddForm && (
            <Card><CardContent>
              <div className='text-center py-12'>
                <p className='text-lg text-slate-600'>No properties yet.</p>
                <p className='text-sm text-slate-500 mt-1'>Click "Add Property" to get started.</p>
              </div>
            </CardContent></Card>
          )}

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {properties.map(property => {
              const tenantList = property.tenantDetails ? Object.entries(property.tenantDetails) : []
              return (
                <div key={property.id} className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow'>
                  <div className='overflow-hidden'><PhotoGrid photos={property.photos} onPhotoClick={setLightboxImage} /></div>
                  <div className='p-4 space-y-3'>
                    <div className='flex items-start justify-between gap-2'>
                      <div>
                        <p className='text-2xl font-bold text-rose-600'>{priceLabel(property)}</p>
                        <p className='font-semibold text-slate-900 mt-0.5'>{property.title}</p>
                      </div>
                      <div className='flex flex-col items-end gap-1 shrink-0'>
                        {property.propertyType && <span className='px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full'>{property.propertyType}</span>}
                        <span className='text-xs text-emerald-600 font-medium'>{property.tenants?.length || 0}/{property.capacity} tenants</span>
                      </div>
                    </div>
                    {property.location?.address && (
                      <div className='flex items-center gap-1.5 text-slate-500'>
                        <svg className='w-3.5 h-3.5 shrink-0' fill='currentColor' viewBox='0 0 24 24'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' /></svg>
                        <span className='text-sm'>{property.location.address}</span>
                      </div>
                    )}
                    {property.description && <p className='text-sm text-slate-600 line-clamp-2'>{property.description}</p>}
                    <div className='flex gap-3 text-xs text-slate-600'>
                      <span className='px-2 py-1 bg-slate-100 rounded-full'>{property.rules?.curfew || 'No Curfew'}</span>
                      {property.rules?.genderRestriction && property.rules.genderRestriction !== 'none' && (
                        <span className='px-2 py-1 bg-slate-100 rounded-full capitalize'>{property.rules.genderRestriction} only</span>
                      )}
                    </div>
                    {property.amenities?.length > 0 && (
                      <div className='flex flex-wrap gap-1.5'>
                        {property.amenities.slice(0, 5).map(a => (
                          <span key={a} className='px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-full'>{a}</span>
                        ))}
                        {property.amenities.length > 5 && <span className='px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-500 text-xs rounded-full'>+{property.amenities.length - 5} more</span>}
                      </div>
                    )}
                    {/* Permit status */}
                    {(() => {
                      const p = property.permits || {}
                      const uploaded = [p.business, p.fireSafety, p.sanitary].filter(Boolean).length
                      return (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${uploaded === 3 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                          <i className={`bi ${uploaded === 3 ? 'bi-patch-check-fill' : 'bi-exclamation-triangle-fill'}`} />
                          {uploaded === 3 ? 'All 3 permits uploaded — Verified' : `${uploaded}/3 permits uploaded`}
                        </div>
                      )
                    })()}
                    {tenantList.length > 0 && (
                      <div className='pt-2 border-t border-slate-100'>
                        <div className='flex items-center justify-between mb-2'>
                          <p className='text-xs font-semibold text-emerald-700 uppercase tracking-wide'>Approved Tenants ({tenantList.length})</p>
                          <button type='button' onClick={() => openConversation({ type: 'group', propertyId: property.id, propertyTitle: property.title })} className='text-xs text-indigo-600 font-semibold hover:text-indigo-800 px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-200 hover:border-indigo-400 transition-colors'>Group Chat</button>
                        </div>
                        <div className='space-y-2'>
                          {tenantList.map(([uid, t]) => {
                            const mo = moveoutRequests.find(r => r.tenantUid === uid && r.propertyId === property.id && r.status === 'pending')
                            return (
                              <div key={uid} className={`rounded-xl border overflow-hidden ${mo ? 'border-amber-200' : 'border-emerald-100'}`}>
                                <div className={`flex items-center justify-between gap-2 p-2 ${mo ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                                  <div className='flex items-center gap-2 min-w-0'>
                                    <div className='w-8 h-8 rounded-full overflow-hidden bg-emerald-200 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0'>
                                      {t.profilePhoto ? <img src={t.profilePhoto} alt='' className='w-full h-full object-cover' /> : t.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className='min-w-0'>
                                      <p className='text-sm font-medium text-slate-900 truncate'>{t.name}</p>
                                      <p className='text-xs text-slate-500 truncate'>{t.email}</p>

                                    </div>
                                  </div>
                                  <div className='flex gap-1.5 shrink-0'>
                                    <button type='button' onClick={() => openConversation({ type: 'dm', otherUser: { uid, name: t.name, profilePhoto: t.profilePhoto || '' } })} className='text-xs text-slate-600 font-semibold hover:text-slate-900 px-2 py-1 bg-white rounded-lg border border-slate-200 hover:border-slate-400 transition-colors'>Message</button>
                                    <button type='button' onClick={() => setViewingTenant({ uid, name: t.name })} className='text-xs text-indigo-600 font-semibold hover:text-indigo-800 px-2 py-1 bg-white rounded-lg border border-indigo-200 hover:border-indigo-400 transition-colors'>Details</button>
                                    <button type='button' onClick={() => handleRemoveTenant(property, uid, t.name)} className='text-xs text-rose-600 font-semibold hover:text-rose-800 px-2 py-1 bg-white rounded-lg border border-rose-200 hover:border-rose-400 transition-colors'>Remove</button>
                                  </div>
                                </div>
                                {mo && (
                                  <div className='flex items-center justify-between gap-2 px-3 py-2 bg-amber-100 border-t border-amber-200'>
                                    <p className='text-xs text-amber-800'>
                                      <i className='bi bi-calendar-x mr-1' />
                                      Move-out requested: <span className='font-bold'>{mo.moveOutDate}</span>
                                      {mo.reason && <span className='text-amber-700 ml-1'>— "{mo.reason}"</span>}
                                    </p>
                                    <button
                                      type='button'
                                      onClick={() => handleConfirmMoveout(mo, property)}
                                      className='text-xs text-rose-700 font-bold hover:text-rose-900 px-2.5 py-1 bg-white rounded-lg border border-rose-300 hover:border-rose-500 transition-colors whitespace-nowrap'
                                    >
                                      Confirm & Remove
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {/* ── Announcements per property ── */}
                    <div className='border-t border-slate-100 pt-3 mt-1'>
                      <div className='flex items-center justify-between mb-2'>
                        <p className='text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1'>
                          <i className='bi bi-megaphone-fill' />Announcements
                          {announcements.filter(a => a.propertyId === property.id).length > 0 && (
                            <span className='text-indigo-500 font-normal'>({announcements.filter(a => a.propertyId === property.id).length})</span>
                          )}
                        </p>
                        <button type='button' onClick={() => { setPostingAnnFor(postingAnnFor === property.id ? null : property.id); setAnnTitle(''); setAnnBody(''); setAnnPinned(false) }}
                          className='text-xs text-indigo-600 font-semibold hover:text-indigo-800 px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-200 hover:border-indigo-400 transition-colors'>
                          {postingAnnFor === property.id ? 'Cancel' : '+ Post'}
                        </button>
                      </div>
                      {postingAnnFor === property.id && (
                        <div className='space-y-2.5 p-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-2'>
                          <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder='Announcement title...'
                            className='w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500' />
                          <textarea value={annBody} onChange={e => setAnnBody(e.target.value)} rows={2} placeholder='Details (optional)...'
                            className='w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none' />
                          <div className='flex items-center justify-between'>
                            <label className='flex items-center gap-2 cursor-pointer'>
                              <button type='button' onClick={() => setAnnPinned(v => !v)}
                                className={`relative w-8 h-4 rounded-full transition-colors ${annPinned ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${annPinned ? 'translate-x-4' : 'translate-x-0.5'}`} />
                              </button>
                              <span className='text-xs text-slate-600 font-medium'>Pin announcement</span>
                            </label>
                            <button type='button' onClick={() => handlePostAnnouncement(property.id, property.title)} disabled={!annTitle.trim() || annSaving}
                              className='text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors'>
                              {annSaving ? 'Posting...' : 'Post'}
                            </button>
                          </div>
                        </div>
                      )}
                      {announcements.filter(a => a.propertyId === property.id).length === 0 ? (
                        <p className='text-xs text-slate-400 py-1'>No announcements yet for this property.</p>
                      ) : (
                        <div className='space-y-1.5'>
                          {announcements.filter(a => a.propertyId === property.id)
                            .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                            .map(ann => (
                              <div key={ann.id} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg ${ann.pinned ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-slate-100'}`}>
                                {ann.pinned && <i className='bi bi-pin-fill text-indigo-500 text-xs mt-0.5 shrink-0' />}
                                <div className='flex-1 min-w-0'>
                                  <p className='text-xs font-semibold text-slate-900 truncate'>{ann.title}</p>
                                  {ann.body && <p className='text-xs text-slate-500 mt-0.5 line-clamp-1'>{ann.body}</p>}
                                </div>
                                <button type='button' onClick={() => handleDeleteAnnouncement(ann.id)} className='text-slate-300 hover:text-rose-500 transition-colors shrink-0'>
                                  <i className='bi bi-trash3 text-xs' />
                                </button>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>

                    <div className='flex gap-2 pt-1'>
                      <Button size='sm' variant='primary' className='flex-1' onClick={() => setEditingProperty(property)}>Edit</Button>
                      <Button size='sm' variant='danger' onClick={() => handleDelete(property.id)}>Delete</Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MAINTENANCE ── */}
      {activeTab === 'maintenance' && (
        <div className='space-y-6'>
          <div>
            <h2 className='text-lg font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Maintenance Requests</h2>
            <p className='text-sm text-slate-500'>Issues submitted by your tenants that need attention.</p>
          </div>

          {maintenanceRequests.length === 0 && (
            <div className='text-center py-16'>
              <i className='bi bi-tools text-5xl text-slate-300 block mb-3' />
              <p className='text-slate-500'>No maintenance requests yet.</p>
            </div>
          )}

          {['open', 'in_progress', 'resolved'].map(statusGroup => {
            const groupReqs = maintenanceRequests.filter(r => r.status === statusGroup)
            if (groupReqs.length === 0) return null
            const groupLabel = statusGroup === 'open' ? 'Open' : statusGroup === 'in_progress' ? 'In Progress' : 'Resolved'
            const groupCls = statusGroup === 'open' ? 'text-rose-700' : statusGroup === 'in_progress' ? 'text-amber-700' : 'text-emerald-700'
            return (
              <div key={statusGroup} className='space-y-3'>
                <p className={`text-xs font-bold uppercase tracking-wide ${groupCls}`}>{groupLabel} ({groupReqs.length})</p>
                {groupReqs.slice().sort((a, b) => {
                  const priOrder = { high: 0, medium: 1, low: 2 }
                  return (priOrder[a.priority] || 1) - (priOrder[b.priority] || 1)
                }).map(req => {
                  const priCfg = { low: { label: 'Low', cls: 'bg-slate-100 text-slate-600' }, medium: { label: 'Medium', cls: 'bg-amber-100 text-amber-700' }, high: { label: 'High', cls: 'bg-rose-100 text-rose-600' } }[req.priority] || { label: req.priority, cls: 'bg-slate-100 text-slate-600' }
                  return (
                    <div key={req.id} className={`p-4 rounded-2xl border ${req.status === 'resolved' ? 'bg-emerald-50 border-emerald-100' : req.priority === 'high' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}>
                      <div className='flex items-start justify-between gap-3'>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2 flex-wrap'>
                            <p className='font-semibold text-slate-900 text-sm'>{req.title}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priCfg.cls}`}>{priCfg.label} Priority</span>
                          </div>
                          <p className='text-xs text-slate-500 mt-0.5'>{req.tenantName} · {req.propertyTitle}</p>
                          <p className='text-xs text-slate-500'>Requested: {formatDate(req.createdAt)} · Started: {formatDate(req.startedAt)} · Resolved: {formatDate(req.resolvedAt)}</p><button className='text-xs text-indigo-600 font-semibold' onClick={() => setMaintenanceCharge(req)}>Create maintenance charge</button>
                          {req.description && <p className='text-sm text-slate-600 mt-1.5 leading-relaxed'>{req.description}</p>}
                        </div>
                        <div className='flex flex-col gap-1.5 shrink-0'>
                          {req.status === 'open' && (
                            <button onClick={() => handleMaintenanceStatus(req, 'in_progress')} className='text-xs font-semibold text-amber-700 hover:text-amber-900 px-2.5 py-1.5 bg-amber-50 rounded-lg border border-amber-200 hover:border-amber-400 transition-colors whitespace-nowrap'>
                              In Progress
                            </button>
                          )}
                          {(req.status === 'open' || req.status === 'in_progress') && (
                            <button onClick={() => handleMaintenanceStatus(req, 'resolved')} className='text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2.5 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200 hover:border-emerald-400 transition-colors whitespace-nowrap'>
                              Resolved ✓
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {activeTab === 'analytics' && premium && <Button onClick={() => exportReport(bills, payments)}>Export payment report</Button>}
      {activeTab === 'analytics' && premium && (
        <div className='space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {[
              { icon: 'bi-cash-stack', label: 'Total Revenue Collected', value: `₱${totalRevenue.toLocaleString()}`, grad: 'from-emerald-500 to-teal-500', desc: `From ${paidRevenuePayments.length} revenue payment${paidRevenuePayments.length !== 1 ? 's' : ''}` },
              { icon: 'bi-hourglass-split', label: 'Pending Collection', value: `₱${pendingAmount.toLocaleString()}`, grad: 'from-amber-500 to-orange-500', desc: 'Under review' },
              { icon: 'bi-building', label: 'Est. Monthly Rent', value: `₱${estMonthlyRent.toLocaleString()}`, grad: 'from-indigo-500 to-violet-500', desc: `${occupiedSlots} occupied slot${occupiedSlots !== 1 ? 's' : ''}` },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className='flex items-center gap-4'>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center shrink-0 shadow-md`}>
                    <i className={`bi ${s.icon} text-white text-xl`} />
                  </div>
                  <div>
                    <p className='text-2xl font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</p>
                    <p className='text-xs text-slate-500'>{s.label}</p>
                    <p className='text-[10px] text-slate-400 mt-0.5'>{s.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>Revenue by Month</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(revenueByMonth).length === 0 ? (
                <p className='text-sm text-slate-500'>No payments collected yet.</p>
              ) : (
                <div className='space-y-3'>
                  {Object.entries(revenueByMonth)
                    .sort(([a], [b]) => (a > b ? -1 : 1))
                    .map(([month, amount]) => (
                      <div key={month} className='flex items-center gap-3'>
                        <span className='text-sm font-medium text-slate-700 w-20 shrink-0'>{month}</span>
                        <div className='flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden'>
                          <div className='h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full' style={{ width: `${Math.min(100, (amount / (totalRevenue || 1)) * 100)}%` }} />
                        </div>
                        <span className='text-sm font-bold text-slate-900 w-24 text-right shrink-0'>₱{Number(amount).toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <Card>
              <CardHeader><CardTitle>Occupancy</CardTitle></CardHeader>
              <CardContent>
                <div className='w-full bg-slate-200 rounded-full h-3'>
                  <div className='bg-indigo-600 h-3 rounded-full transition-all' style={{ width: `${totalCapacity > 0 ? (occupiedSlots / totalCapacity) * 100 : 0}%` }} />
                </div>
                <p className='text-sm text-slate-600 mt-2'>{occupiedSlots}/{totalCapacity} slots occupied</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Billing Summary</CardTitle></CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  <div className='flex justify-between text-sm'><span className='text-slate-600'>Total Bills Posted</span><span className='font-bold'>{bills.length}</span></div>
                  <div className='flex justify-between text-sm'><span className='text-slate-600'>Paid</span><span className='font-bold text-emerald-600'>{payments.filter(p => p.status === 'paid').length}</span></div>
                  <div className='flex justify-between text-sm'><span className='text-slate-600'>Under Review</span><span className='font-bold text-amber-600'>{payments.filter(p => p.status === 'under_review').length}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── PROFILE ── */}
      {activeTab === 'analytics' && !premium && <div className='p-6 bg-white border rounded-xl'><p>Revenue analytics are included in paid landlord plans.</p><Button onClick={() => setActiveTab('plans')}>View plans</Button></div>}
      {activeTab === 'profile' && (
        <div className='max-w-xl space-y-6'>
          <Card>
            <CardHeader><CardTitle>Profile Photo</CardTitle></CardHeader>
            <CardContent>
              <div className='flex items-center gap-6'>
                <div className='w-20 h-20 rounded-full overflow-hidden bg-indigo-100 border-2 border-indigo-200 shrink-0'>
                  {profilePhoto ? <img src={profilePhoto} alt='Profile' className='w-full h-full object-cover' /> : <div className='w-full h-full flex items-center justify-center text-2xl font-bold text-indigo-600'>{displayName.charAt(0).toUpperCase()}</div>}
                </div>
                <div>
                  <label className='cursor-pointer'>
                    <span className='px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors'>{photoUploading ? 'Processing...' : 'Upload Photo'}</span>
                    <input type='file' accept='image/*' className='hidden' onChange={handleProfilePhotoUpload} disabled={photoUploading} />
                  </label>
                  <p className='text-xs text-slate-500 mt-2'>JPG, PNG — compressed automatically</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Account Info</CardTitle></CardHeader>
            <CardContent className='space-y-4'>
              <div><Label>Full Name</Label><Input value={profileName} onChange={e => setProfileName(e.target.value)} /></div>
              <div><Label>Email</Label><Input value={user.email} disabled className='opacity-60 cursor-not-allowed' /></div>
              <div><Label>Phone Number</Label><Input type='tel' value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder='e.g. 09123456789' /></div>
              <div>
                <Label>About / Bio</Label>
                <textarea value={profileBio} onChange={e => setProfileBio(e.target.value)} rows={3}
                  placeholder='Tell tenants about yourself — your management style, years of experience, etc...'
                  className='w-full mt-1 px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none' />
              </div>
              {profileMsg && <p className={`text-sm ${profileMsg.includes('failed') || profileMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{profileMsg}</p>}
              <Button onClick={handleSaveProfile} variant='primary' disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Save Changes'}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle>Landlord Verification</CardTitle>
                {landlordIsVerified && (
                  <span className='flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full'>
                    <i className='bi bi-patch-check-fill' /> Verified
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              {landlordIsVerified ? (
                <div className='p-4 bg-emerald-50 border border-emerald-200 rounded-xl'>
                  <p className='text-sm font-semibold text-emerald-800 flex items-center gap-2'>
                    <i className='bi bi-patch-check-fill text-emerald-600' /> You are a Verified Landlord
                  </p>
                  <p className='text-xs text-emerald-600 mt-1'>Both required documents are on file. Your listings show a Verified badge to prospective tenants.</p>
                </div>
              ) : (
                <div className='p-3.5 bg-amber-50 border border-amber-200 rounded-xl'>
                  <p className='text-sm font-semibold text-amber-800'>Upload both documents for review</p>
                  <p className='text-xs text-amber-700 mt-1'>The Verified Landlord badge appears after an authorized reviewer approves your documents.</p>
                </div>
              )}

              <div className='space-y-3'>
                <div className={`p-3.5 rounded-xl border ${govIdDoc ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2.5 min-w-0'>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${govIdDoc ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        <i className={`bi bi-person-vcard text-lg ${govIdDoc ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                      <div className='min-w-0'>
                        <p className='text-sm font-semibold text-slate-900'>Government-Issued ID</p>
                        <p className='text-xs text-slate-500'>Passport, Driver's License, SSS/GSIS, PhilHealth</p>
                        {govIdDoc && <p className='text-xs text-emerald-600 font-medium mt-0.5 truncate'><i className='bi bi-check-circle-fill mr-1' />{govIdDoc.fileName}</p>}
                      </div>
                    </div>
                    <label className='cursor-pointer shrink-0'>
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${verifyingGovId ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : govIdDoc ? 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {verifyingGovId ? 'Uploading...' : govIdDoc ? 'Replace' : 'Upload'}
                      </span>
                      <input type='file' accept='image/*,.pdf' className='hidden' onChange={e => handleUploadVerificationDoc(e, 'govId')} disabled={verifyingGovId} />
                    </label>
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border ${ownerProofDoc ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2.5 min-w-0'>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ownerProofDoc ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        <i className={`bi bi-file-earmark-text text-lg ${ownerProofDoc ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                      <div className='min-w-0'>
                        <p className='text-sm font-semibold text-slate-900'>Proof of Property Ownership</p>
                        <p className='text-xs text-slate-500'>Land Title, Tax Declaration, or Deed of Sale</p>
                        {ownerProofDoc && <p className='text-xs text-emerald-600 font-medium mt-0.5 truncate'><i className='bi bi-check-circle-fill mr-1' />{ownerProofDoc.fileName}</p>}
                      </div>
                    </div>
                    <label className='cursor-pointer shrink-0'>
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${verifyingOwnerProof ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : ownerProofDoc ? 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {verifyingOwnerProof ? 'Uploading...' : ownerProofDoc ? 'Replace' : 'Upload'}
                      </span>
                      <input type='file' accept='image/*,.pdf' className='hidden' onChange={e => handleUploadVerificationDoc(e, 'ownershipProof')} disabled={verifyingOwnerProof} />
                    </label>
                  </div>
                </div>
              </div>
              <p className='text-xs text-slate-400'>Documents are stored securely for identity verification only. Accepted: JPG, PNG, PDF</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
            <CardContent className='space-y-3'>
              <div><Label>Current Password</Label><Input type='password' value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} placeholder='Enter current password' /></div>
              <div><Label>New Password</Label><Input type='password' value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder='At least 6 characters' /></div>
              <div><Label>Confirm New Password</Label><Input type='password' value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder='Repeat new password' /></div>
              {pwMsg && <p className={`text-sm ${pwMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{pwMsg}</p>}
              <Button onClick={handleChangePassword} variant='primary'>Update Password</Button>
            </CardContent>
          </Card>
          <Card><CardContent><Button onClick={logout} variant='danger' className='w-full'>Sign Out</Button></CardContent></Card>
        </div>
      )}

      {/* ── Modals ── */}
      {editingProperty && <EditPropertyModal property={editingProperty} onClose={() => setEditingProperty(null)} />}
      {viewingTenant && <TenantDetailModal tenantUid={viewingTenant.uid} tenantName={viewingTenant.name} onClose={() => setViewingTenant(null)} />}
      {maintenanceCharge && <PostBillModal properties={properties} landlordUid={user.uid} maintenanceRequest={maintenanceCharge} onClose={() => setMaintenanceCharge(null)} />}
      {showPostBill && <PostBillModal properties={properties} landlordUid={user.uid} onClose={() => setShowPostBill(false)} />}

      <ConfirmModal dialog={dialog} onClose={() => setDialog(null)} />

      {lightboxImage && (
        <div className='fixed inset-0 z-[60] bg-black/92 flex items-center justify-center p-4' onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt='Full size' className='max-w-full max-h-full object-contain rounded-xl' />
          <button className='absolute top-4 right-4 text-white text-4xl font-light leading-none hover:text-slate-300' onClick={() => setLightboxImage(null)}>×</button>
        </div>
      )}
    </div>
  )
}
