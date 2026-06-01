import React, { useState, useRef } from 'react'
import { compressToBase64 } from '../../../lib/compressToBase64'

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const PERMITS = [
  {
    key: 'business',
    label: 'Business Permit',
    description: 'DTI/SEC Registration, Barangay Clearance, or Mayor\'s/Business Permit',
    icon: 'bi-building-check',
    color: 'indigo',
  },
  {
    key: 'fireSafety',
    label: 'Fire Safety Certificate',
    description: 'Fire Safety Inspection Certificate (FSIC) from the Bureau of Fire Protection',
    icon: 'bi-shield-check',
    color: 'rose',
  },
  {
    key: 'sanitary',
    label: 'Sanitary Permit',
    description: 'Sanitary Permit to Operate from the City/Municipal Health Office',
    icon: 'bi-clipboard2-pulse',
    color: 'emerald',
  },
]

const COLOR = {
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', icon: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', btn: 'border-indigo-200 hover:border-indigo-400 text-indigo-600 hover:text-indigo-800' },
  rose:   { bg: 'bg-rose-50',   border: 'border-rose-100',   icon: 'text-rose-600',   badge: 'bg-rose-100 text-rose-700',   btn: 'border-rose-200 hover:border-rose-400 text-rose-600 hover:text-rose-800' },
  emerald:{ bg: 'bg-emerald-50',border: 'border-emerald-100',icon: 'text-emerald-600',badge: 'bg-emerald-100 text-emerald-700',btn: 'border-emerald-200 hover:border-emerald-400 text-emerald-600 hover:text-emerald-800' },
}

const SinglePermit = ({ permit: cfg, value, onChange }) => {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const c = COLOR[cfg.color]

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      setError('File must be under 3 MB.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const isImage = file.type.startsWith('image/')
      const data = isImage
        ? await compressToBase64(file, { maxPx: 1400, quality: 0.88 })
        : await readAsBase64(file)
      onChange({ data, name: file.name, fileType: isImage ? 'image' : 'pdf' })
    } catch (err) {
      setError('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const clear = () => {
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
    setError('')
  }

  return (
    <div className={`rounded-2xl border ${value ? `${c.bg} ${c.border}` : 'border-slate-200 bg-white'} overflow-hidden transition-all`}>
      <div className='flex items-start gap-3 p-4'>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${value ? c.bg : 'bg-slate-100'}`}>
          <i className={`bi ${cfg.icon} text-base ${value ? c.icon : 'text-slate-400'}`} />
        </div>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2'>
            <p className='text-sm font-semibold text-slate-900'>{cfg.label}</p>
            {value && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.badge}`}>Uploaded</span>
            )}
          </div>
          <p className='text-xs text-slate-500 mt-0.5 leading-relaxed'>{cfg.description}</p>
        </div>
        {value && (
          <button type='button' onClick={clear} className='text-xs text-slate-400 hover:text-rose-500 transition-colors shrink-0'>
            <i className='bi bi-x-circle' />
          </button>
        )}
      </div>

      {value ? (
        <div className='mx-4 mb-4 flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100'>
          {value.fileType === 'image' ? (
            <img src={value.data} alt={value.name} className='w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0' />
          ) : (
            <div className='w-14 h-14 bg-rose-50 rounded-lg flex items-center justify-center shrink-0 border border-rose-100'>
              <i className='bi bi-file-earmark-pdf-fill text-rose-500 text-2xl' />
            </div>
          )}
          <div className='min-w-0 flex-1'>
            <p className='text-xs font-semibold text-slate-700 truncate'>{value.name}</p>
            <p className='text-[11px] text-slate-400 mt-0.5'>{value.fileType === 'pdf' ? 'PDF Document' : 'Image'}</p>
          </div>
          <label className={`cursor-pointer text-xs font-semibold px-2.5 py-1.5 bg-white rounded-lg border transition-colors shrink-0 ${c.btn}`}>
            Replace
            <input ref={inputRef} type='file' accept='image/*,application/pdf' className='hidden' onChange={handleFile} disabled={uploading} />
          </label>
        </div>
      ) : (
        <label className='mx-4 mb-4 flex flex-col items-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-all'>
          <i className={`bi bi-cloud-upload text-slate-300 text-2xl ${uploading ? 'animate-pulse' : ''}`} />
          <p className='text-xs text-slate-400 text-center'>
            {uploading ? 'Uploading…' : 'Click to upload — JPG, PNG, or PDF (max 3 MB)'}
          </p>
          <input ref={inputRef} type='file' accept='image/*,application/pdf' className='hidden' onChange={handleFile} disabled={uploading} />
        </label>
      )}

      {error && <p className='mx-4 mb-4 text-xs text-rose-600'>{error}</p>}
    </div>
  )
}

export const PermitUploader = ({ value = {}, onChange }) => {
  const update = (key) => (v) => onChange({ ...value, [key]: v })
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2 mb-1'>
        <i className='bi bi-patch-check-fill text-indigo-600' />
        <p className='text-sm font-bold text-slate-900'>Required Permits <span className='text-xs font-normal text-slate-500 ml-1'>(upload all 3 for verified status)</span></p>
      </div>
      {PERMITS.map(cfg => (
        <SinglePermit
          key={cfg.key}
          permit={cfg}
          value={value?.[cfg.key] || null}
          onChange={update(cfg.key)}
        />
      ))}
    </div>
  )
}

export { PERMITS }
