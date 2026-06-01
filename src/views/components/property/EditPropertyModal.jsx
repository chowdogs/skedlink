import React, { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../../firebase'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card'
import { Input, Label } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { LocationPicker } from '../map/LocationPicker'
import { ImageUploader } from '../map/ImageUploader'
import { PermitUploader } from './PermitUploader'

const PROPERTY_TYPES = ['Condo/Apartment', 'Studio', 'Room', 'House', 'Townhouse']
const AMENITIES = [
  'Parking', 'Pool', 'Gym', 'WiFi', 'Aircon',
  'Balcony', 'Elevator', 'Security', 'Laundry', 'Pets Allowed',
  'Kitchen', 'Water Heater', 'Refrigerator', 'CCTV', 'TV/Cable',
  'Generator', 'Near Transport'
]

export const EditPropertyModal = ({ property, onClose }) => {
  const [form, setForm] = useState({
    title: property.title || '',
    description: property.description || '',
    price: property.price || '',
    capacity: property.capacity || '',
    propertyType: property.propertyType || '',
    amenities: property.amenities || [],
    curfewEnabled: property.rules?.curfewEnabled ?? (!!property.rules?.curfew && property.rules.curfew !== 'None' && property.rules.curfew !== 'No Curfew'),
    curfew: property.rules?.curfew && property.rules.curfew !== 'None' && property.rules.curfew !== 'No Curfew' ? property.rules.curfew : '',
    genderRestriction: property.rules?.genderRestriction || 'none',
    photos: property.photos || [],
    location: property.location || null,
    permits: property.permits || {},
    houseRules: property.houseRules || '',
    emergencyContacts: property.emergencyContacts || []
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const toggleAmenity = (a) =>
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter(x => x !== a)
        : [...prev.amenities, a]
    }))

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.location) { setError('Please pin the property location on the map.'); return }
    setSaving(true)
    try {
      await updateDoc(doc(db, 'properties', property.id), {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        capacity: Number(form.capacity),
        propertyType: form.propertyType,
        amenities: form.amenities,
        rules: {
          curfewEnabled: form.curfewEnabled,
          curfew: form.curfewEnabled ? (form.curfew || 'Set time') : 'No Curfew',
          genderRestriction: form.genderRestriction
        },
        photos: form.photos,
        location: form.location,
        permits: form.permits || {},
        houseRules: form.houseRules,
        emergencyContacts: form.emergencyContacts
      })
      onClose()
    } catch (err) {
      setError('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4'>
      <div className='w-full max-w-2xl'>
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle>Edit Property</CardTitle>
              <button
                type='button'
                onClick={onClose}
                className='text-slate-400 hover:text-slate-700 text-2xl font-light leading-none'
              >
                ×
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className='space-y-5'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='md:col-span-2'>
                  <Label htmlFor='title'>Property Title</Label>
                  <Input id='title' value={form.title} onChange={set('title')} required />
                </div>

                <div className='md:col-span-2'>
                  <Label htmlFor='description'>Description</Label>
                  <textarea
                    id='description'
                    value={form.description}
                    onChange={set('description')}
                    rows={3}
                    placeholder='Describe your property, amenities, house rules...'
                    className='w-full px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none'
                  />
                </div>

                <div>
                  <Label htmlFor='price'>Monthly Price (₱)</Label>
                  <Input id='price' type='number' min='0' value={form.price} onChange={set('price')} required />
                </div>

                <div>
                  <Label htmlFor='capacity'>Capacity</Label>
                  <Input id='capacity' type='number' min='1' value={form.capacity} onChange={set('capacity')} required />
                </div>

                {/* Property Type */}
                <div className='md:col-span-2'>
                  <Label>Property Type</Label>
                  <div className='flex flex-wrap gap-2 mt-1'>
                    {PROPERTY_TYPES.map(type => (
                      <button
                        key={type}
                        type='button'
                        onClick={() => setForm(prev => ({ ...prev, propertyType: prev.propertyType === type ? '' : type }))}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                          form.propertyType === type
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Curfew toggle */}
                <div>
                  <Label>Curfew</Label>
                  <div className='flex items-center gap-3 mt-1'>
                    <button
                      type='button'
                      onClick={() => setForm(prev => ({ ...prev, curfewEnabled: !prev.curfewEnabled }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${form.curfewEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.curfewEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className='text-sm text-slate-600'>{form.curfewEnabled ? 'Enabled' : 'No Curfew'}</span>
                  </div>
                  {form.curfewEnabled && (
                    <Input className='mt-2' placeholder='e.g. 10:00 PM' value={form.curfew} onChange={set('curfew')} />
                  )}
                </div>

                <div>
                  <Label>Gender Restriction</Label>
                  <select
                    value={form.genderRestriction}
                    onChange={set('genderRestriction')}
                    className='w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-1'
                  >
                    <option value='none'>No Restriction</option>
                    <option value='male'>Male Only</option>
                    <option value='female'>Female Only</option>
                  </select>
                </div>
              </div>

              {/* House Rules */}
              <div className='md:col-span-2'>
                <Label>House Rules</Label>
                <textarea
                  value={form.houseRules}
                  onChange={set('houseRules')}
                  rows={3}
                  placeholder='e.g. No smoking inside, no loud music after 10pm, keep common areas clean...'
                  className='w-full mt-1 px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none'
                />
              </div>

              {/* Emergency Contacts */}
              <div className='md:col-span-2'>
                <Label>Emergency Contacts</Label>
                <div className='space-y-2 mt-1'>
                  {form.emergencyContacts.map((c, i) => (
                    <div key={i} className='flex gap-2'>
                      <input
                        placeholder='Label (e.g. Landlord, Fire Dept)'
                        value={c.label}
                        onChange={e => {
                          const contacts = [...form.emergencyContacts]
                          contacts[i] = { ...contacts[i], label: e.target.value }
                          setForm(prev => ({ ...prev, emergencyContacts: contacts }))
                        }}
                        className='flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
                      />
                      <input
                        placeholder='Number'
                        value={c.number}
                        onChange={e => {
                          const contacts = [...form.emergencyContacts]
                          contacts[i] = { ...contacts[i], number: e.target.value }
                          setForm(prev => ({ ...prev, emergencyContacts: contacts }))
                        }}
                        className='w-40 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
                      />
                      <button type='button' onClick={() => setForm(prev => ({ ...prev, emergencyContacts: prev.emergencyContacts.filter((_, j) => j !== i) }))}
                        className='text-slate-400 hover:text-rose-500 transition-colors px-2'>
                        <i className='bi bi-x-circle' />
                      </button>
                    </div>
                  ))}
                  <button type='button'
                    onClick={() => setForm(prev => ({ ...prev, emergencyContacts: [...prev.emergencyContacts, { label: '', number: '' }] }))}
                    className='text-xs text-indigo-600 font-semibold hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-200 transition-colors'>
                    <i className='bi bi-plus-lg mr-1' />Add Contact
                  </button>
                </div>
              </div>

              {/* Amenities */}
              <div>
                <Label>Amenities</Label>
                <div className='flex flex-wrap gap-2 mt-2'>
                  {AMENITIES.map(a => (
                    <button
                      key={a}
                      type='button'
                      onClick={() => toggleAmenity(a)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                        form.amenities.includes(a)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photos */}
              <div>
                <Label>Property Photos</Label>
                <ImageUploader
                  value={form.photos}
                  onChange={(photos) => setForm(prev => ({ ...prev, photos }))}
                />
              </div>

              {/* Permits */}
              <div>
                <PermitUploader
                  value={form.permits}
                  onChange={(permits) => setForm(prev => ({ ...prev, permits }))}
                />
              </div>

              {/* Location */}
              <div>
                <Label>Property Location</Label>
                <p className='text-xs text-slate-500 mb-2'>Search or click to update pin.</p>
                <LocationPicker
                  value={form.location}
                  onChange={(loc) => setForm(prev => ({ ...prev, location: loc }))}
                />
              </div>

              {error && (
                <p className='text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg'>{error}</p>
              )}

              <div className='flex gap-3 pt-2'>
                <Button type='submit' variant='primary' disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type='button' variant='secondary' onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
