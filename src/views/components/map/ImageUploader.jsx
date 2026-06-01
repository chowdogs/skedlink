import React, { useState, useRef } from 'react'
import { compressToBase64 } from '../../../lib/compressToBase64'

export const ImageUploader = ({ value = [], onChange }) => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setError('')
    setUploading(true)
    try {
      const b64s = await Promise.all(
        files.map(f => compressToBase64(f, { maxPx: 1000, quality: 0.78 }))
      )
      onChange([...value, ...b64s])
    } catch (err) {
      setError('Failed to process image: ' + err.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removePhoto = (index) => onChange(value.filter((_, i) => i !== index))

  return (
    <div className='space-y-3'>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer
          ${uploading ? 'border-slate-200 bg-slate-50 cursor-not-allowed' : 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100'}`}
      >
        <input
          ref={inputRef}
          type='file'
          accept='image/*'
          multiple
          className='hidden'
          onChange={handleFiles}
          disabled={uploading}
        />
        {uploading ? (
          <>
            <div className='w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin' />
            <p className='text-sm text-slate-500'>Processing photos...</p>
          </>
        ) : (
          <>
            <svg className='w-8 h-8 text-indigo-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5}
                d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5' />
            </svg>
            <p className='text-sm font-medium text-indigo-700'>Click to upload photos</p>
            <p className='text-xs text-slate-400'>Any size — auto-compressed for storage</p>
          </>
        )}
      </div>

      {error && (
        <p className='text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg'>{error}</p>
      )}

      {value.length > 0 && (
        <div className='grid grid-cols-3 gap-2'>
          {value.map((src, i) => (
            <div key={i} className='relative group rounded-lg overflow-hidden border border-slate-200 aspect-video'>
              <img src={src} alt={`Photo ${i + 1}`} className='w-full h-full object-cover' />
              <button
                type='button'
                onClick={() => removePhoto(i)}
                className='absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
