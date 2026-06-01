import React from 'react'

export const Card = React.forwardRef(({ children, className }, ref) => (
  <div
    ref={ref}
    className={`bg-white rounded-2xl border border-slate-100 shadow-card ${className || ''}`}
  >
    {children}
  </div>
))

Card.displayName = 'Card'

export const CardHeader = ({ children, className }) => (
  <div className={`px-6 pt-6 pb-4 ${className || ''}`}>
    {children}
  </div>
)

export const CardTitle = ({ children, className }) => (
  <h2 className={`text-lg font-bold text-slate-900 ${className || ''}`} style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>
    {children}
  </h2>
)

export const CardDescription = ({ children, className }) => (
  <p className={`text-sm text-slate-500 mt-1 ${className || ''}`}>
    {children}
  </p>
)

export const CardContent = ({ children, className }) => (
  <div className={`px-6 pb-6 ${className || ''}`}>
    {children}
  </div>
)

export const CardFooter = ({ children, className }) => (
  <div className={`px-6 pb-6 pt-4 border-t border-slate-100 flex gap-3 ${className || ''}`}>
    {children}
  </div>
)
