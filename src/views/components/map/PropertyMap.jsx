import React, { useState, useEffect, useRef } from 'react'
import { priceLabel } from '../../../lib/rentalTerms'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

const DEFAULT_CENTER = [14.5995, 120.9842]

const scoreIcon = (score) => {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#6366f1' : score >= 40 ? '#f59e0b' : '#ef4444'
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:white;font-weight:700;font-size:11px;padding:3px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid white;">${score}%</div>`,
    iconAnchor: [20, 10]
  })
}

async function searchPlaces(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    return await res.json()
  } catch {
    return []
  }
}

function FlyTo({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 14, { duration: 1.2 })
  }, [position, map])
  return null
}

export const PropertyMap = ({ properties }) => {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const [flyTarget, setFlyTarget] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  const mapped = properties.filter(p => p.location?.lat && p.location?.lng)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced autocomplete
  useEffect(() => {
    if (query.length < 3) { setSuggestions([]); setShowSuggestions(false); return }
    clearTimeout(debounceRef.current)
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(query)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
      setSearching(false)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const selectSuggestion = (place) => {
    setFlyTarget([parseFloat(place.lat), parseFloat(place.lon)])
    setQuery(place.display_name.split(',')[0])
    setShowSuggestions(false)
    setSuggestions([])
    if (!expanded) setExpanded(true)
  }

  return (
    <div className='space-y-3'>
      {/* Header row with toggle */}
      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium text-slate-700'>
          {mapped.length} propert{mapped.length === 1 ? 'y' : 'ies'} on map
        </span>
        <button
          type='button'
          onClick={() => setExpanded(v => !v)}
          className='flex items-center gap-1 px-3 py-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors'
        >
          {expanded ? '▲ Hide Map' : '▼ Show Map'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Autocomplete search */}
          <div className='relative' ref={wrapperRef}>
            <div className='flex gap-2'>
              <input
                type='text'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder='Search area or city (e.g. San Jose, Baliwag)...'
                className='flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
              />
              {searching && (
                <span className='flex items-center px-3 text-xs text-slate-400'>Searching...</span>
              )}
            </div>

            {/* Dropdown results */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className='absolute z-[1000] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto'>
                {suggestions.map((place, i) => (
                  <li key={i}>
                    <button
                      type='button'
                      onClick={() => selectSuggestion(place)}
                      className='w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors border-b border-slate-100 last:border-0'
                    >
                      <span className='font-medium block truncate'>{place.display_name.split(',')[0]}</span>
                      <span className='text-xs text-slate-400 block truncate'>{place.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Map */}
          <div className='rounded-xl overflow-hidden border border-slate-200' style={{ height: 380 }}>
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {flyTarget && <FlyTo position={flyTarget} />}
              {mapped.map(property => (
                <Marker
                  key={property.id}
                  position={[property.location.lat, property.location.lng]}
                  icon={scoreIcon(property.score)}
                >
                  <Popup>
                    <div className='text-sm' style={{ minWidth: 160 }}>
                        {property.photos?.[0] && (
                        <img src={property.photos[0]} alt={property.title}
                          style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} />
                      )}
                      <p className='font-bold text-slate-900 mb-1'>{property.title}</p>
                      <p className='text-slate-500 text-xs mb-1'>{property.location.address}</p>
                      <p className='text-slate-700'>{priceLabel(property)}</p>
                      <p className='text-slate-700'>{property.tenants?.length || 0}/{property.capacity} tenants</p>
                      <p className='font-bold mt-1' style={{ color: property.score >= 60 ? '#10b981' : '#f59e0b' }}>
                        {property.rentalTerms?.occupancy === 'exclusive' ? 'Private room' : property.score == null ? 'No score yet' : `${property.score}% match`}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {mapped.length === 0 && (
            <p className='text-xs text-slate-500 text-center'>No properties with map locations yet.</p>
          )}
        </>
      )}
    </div>
  )
}
