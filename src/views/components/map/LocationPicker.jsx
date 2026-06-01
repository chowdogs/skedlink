import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

const DEFAULT_CENTER = [14.5995, 120.9842]
const DEFAULT_ZOOM = 12

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng.lat, e.latlng.lng) }
  })
  return null
}

function FlyTo({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 1.2 })
  }, [position, map])
  return null
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
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

export const LocationPicker = ({ value, onChange }) => {
  const [pinPos, setPinPos] = useState(value ? [value.lat, value.lng] : null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

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

  // Debounced autocomplete as user types
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
    const lat = parseFloat(place.lat)
    const lng = parseFloat(place.lon)
    setPinPos([lat, lng])
    setFlyTarget([lat, lng])
    onChange({ lat, lng, address: place.display_name })
    setQuery(place.display_name)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const handleMapClick = async (lat, lng) => {
    setPinPos([lat, lng])
    const address = await reverseGeocode(lat, lng)
    setQuery(address)
    onChange({ lat, lng, address })
  }

  return (
    <div className='space-y-2'>
      {/* Autocomplete search — NOT inside a <form> to prevent outer form submission */}
      <div className='relative' ref={wrapperRef}>
        <div className='flex gap-2'>
          <input
            type='text'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder='Search address or place...'
            className='flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
          />
          {searching && (
            <span className='flex items-center px-3 text-xs text-slate-400'>Searching...</span>
          )}
        </div>

        {/* Suggestions dropdown */}
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
                  <span className='text-xs text-slate-400 truncate block'>{place.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className='text-xs text-slate-500'>Or click directly on the map to drop a pin.</p>

      {/* Map */}
      <div className='rounded-xl overflow-hidden border border-slate-200' style={{ height: 320 }}>
        <MapContainer
          center={pinPos || DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ClickHandler onPick={handleMapClick} />
          {flyTarget && <FlyTo position={flyTarget} />}
          {pinPos && <Marker position={pinPos} />}
        </MapContainer>
      </div>

      {value?.address && (
        <div className='text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2'>
          <span className='font-medium text-slate-800'>Pinned: </span>{value.address}
        </div>
      )}
    </div>
  )
}
