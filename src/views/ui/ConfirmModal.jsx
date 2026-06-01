import React, { useState } from 'react'

export const ConfirmModal = ({ dialog, onClose }) => {
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!dialog) return null

  const isDanger = dialog.variant === 'danger'

  const handleConfirm = async () => {
    setLoading(true)
    setError('')
    try {
      await dialog.onConfirm(inputValue)
      onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className='fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <div className='bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden'>
        <div className='px-6 pt-7 pb-3 flex flex-col items-center text-center'>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
            isDanger ? 'bg-rose-100' : 'bg-indigo-100'
          }`}>
            <i className={`bi ${dialog.icon || (isDanger ? 'bi-exclamation-triangle-fill' : 'bi-question-circle-fill')} text-2xl ${
              isDanger ? 'text-rose-500' : 'text-indigo-600'
            }`} />
          </div>
          <h3 className='text-lg font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {dialog.title}
          </h3>
          {dialog.message && (
            <p className='text-sm text-slate-500 mt-1.5 leading-relaxed'>{dialog.message}</p>
          )}
        </div>

        {dialog.hasInput && (
          <div className='px-6 pb-1 pt-2'>
            {dialog.inputLabel && (
              <p className='text-xs font-semibold text-slate-600 mb-1.5'>{dialog.inputLabel}</p>
            )}
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={dialog.inputPlaceholder || ''}
              rows={2}
              autoFocus
              className='w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none'
            />
          </div>
        )}

        {error && (
          <p className='mx-6 mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2'>{error}</p>
        )}

        <div className='flex gap-3 px-6 py-5'>
          <button
            onClick={onClose}
            disabled={loading}
            className='flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50'
          >
            {dialog.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-sm ${
              isDanger
                ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700'
            }`}
          >
            {loading ? 'Please wait…' : (dialog.confirmLabel || 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
