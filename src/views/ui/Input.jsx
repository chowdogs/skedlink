import React from 'react'

export const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 focus:bg-white transition-all ${className || ''}`}
    {...props}
  />
))

Input.displayName = 'Input'

export const Label = ({ htmlFor, children, className }) => (
  <label htmlFor={htmlFor} className={`block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 ${className || ''}`}>
    {children}
  </label>
)

export const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 focus:bg-white transition-all resize-none ${className || ''}`}
    {...props}
  />
))

Textarea.displayName = 'Textarea'
