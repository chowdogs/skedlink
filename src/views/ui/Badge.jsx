import React from 'react'

export const Badge = ({ children, variant = 'primary', className }) => {
  const variants = {
    primary: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border border-rose-100',
    slate: 'bg-slate-100 text-slate-600 border border-slate-200',
    violet: 'bg-violet-50 text-violet-700 border border-violet-100',
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant] || variants.primary} ${className || ''}`}>
      {children}
    </span>
  )
}
