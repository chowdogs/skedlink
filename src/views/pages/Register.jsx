import React, { useState } from 'react'
import { Input, Label } from '../ui/Input'
import { useAuth } from '../../contexts/AuthContext'

export const Register = ({ onRegister, onGoToLogin, onBack }) => {
  const { register } = useAuth()
  const [role, setRole] = useState('seeker')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      const profile = await register(email, password, fullName, role, phone)
      onRegister(profile)
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen flex' style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Left panel */}
      <div className='hidden lg:flex lg:w-[45%] relative flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-12 overflow-hidden'>
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute -top-20 -right-20 w-72 h-72 bg-violet-600/20 rounded-full blur-3xl' />
          <div className='absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl' />
        </div>

        <div className='relative z-10 max-w-sm text-center space-y-6'>
          <div className='flex items-center justify-center gap-2.5 mb-8'>
            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg'>
              <svg className='w-5 h-5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M13 10V3L4 14h7v7l9-11h-7z' />
              </svg>
            </div>
            <span className='text-2xl font-bold text-white' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              SkedLink
            </span>
          </div>

          <h2 className='text-3xl font-bold text-white leading-tight' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Join a smarter way to find housing
          </h2>
          <p className='text-slate-300 text-sm leading-relaxed'>
            Create your profile, set your schedule, and get matched with compatible dormitories and housemates.
          </p>

          {/* Roles explained */}
          <div className='space-y-3 text-left mt-4'>
            <div className='bg-white/10 border border-white/10 rounded-xl px-4 py-3'>
              <p className='text-sm font-bold text-white mb-0.5'>Tenant</p>
              <p className='text-xs text-slate-300'>Browse properties, send inquiries, get matched by schedule compatibility</p>
            </div>
            <div className='bg-white/10 border border-white/10 rounded-xl px-4 py-3'>
              <p className='text-sm font-bold text-white mb-0.5'>Landlord</p>
              <p className='text-xs text-slate-300'>List your property, review applicants, manage approved tenants</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className='flex-1 flex flex-col items-center justify-center bg-white px-6 py-12'>
        {onBack && (
          <button
            onClick={onBack}
            className='self-start mb-6 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
            </svg>
            Back to home
          </button>
        )}

        <div className='w-full max-w-sm space-y-6'>
          {/* Mobile logo */}
          <div className='lg:hidden flex items-center gap-2 mb-2'>
            <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center'>
              <svg className='w-4 h-4 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M13 10V3L4 14h7v7l9-11h-7z' />
              </svg>
            </div>
            <span className='text-lg font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>SkedLink</span>
          </div>

          <div>
            <h1 className='text-3xl font-bold text-slate-900' style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Create Account</h1>
            <p className='text-slate-500 text-sm mt-1'>Join SkedLink — it's free</p>
          </div>

          <form onSubmit={handleSubmit} className='space-y-4'>
            {/* Role selector */}
            <div>
              <Label>I am a</Label>
              <div className='grid grid-cols-2 gap-2 mt-1'>
                {[
                  { val: 'seeker', label: 'Tenant', icon: 'bi-house-door' },
                  { val: 'owner', label: 'Landlord', icon: 'bi-key' },
                ].map(r => (
                  <button
                    key={r.val}
                    type='button'
                    onClick={() => setRole(r.val)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border-2 transition-all ${
                      role === r.val
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <i className={`bi ${r.icon}`} />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor='fullName'>Full Name</Label>
              <Input id='fullName' placeholder='Juan dela Cruz' value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>

            <div>
              <Label htmlFor='email'>Email Address</Label>
              <Input id='email' type='email' placeholder='you@email.com' value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div>
              <Label htmlFor='phone'>Phone Number</Label>
              <Input id='phone' type='tel' placeholder='+63 917 123 4567' value={phone} onChange={e => setPhone(e.target.value)} required />
            </div>

            <div>
              <Label htmlFor='password'>Password</Label>
              <div className='relative'>
                <Input id='password' type={showPw ? 'text' : 'password'} placeholder='At least 6 characters' value={password} onChange={e => setPassword(e.target.value)} required />
                <button type='button' onClick={() => setShowPw(v => !v)} className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700'>
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    {showPw
                      ? <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' />
                      : <><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' /></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor='confirmPassword'>Confirm Password</Label>
              <Input id='confirmPassword' type='password' placeholder='Repeat your password' value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>

            {error && (
              <div className='flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl'>
                <svg className='w-4 h-4 text-rose-500 mt-0.5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                </svg>
                <p className='text-sm text-rose-700'>{error}</p>
              </div>
            )}

            <button
              type='submit'
              disabled={loading}
              className='w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl hover:from-violet-700 hover:to-indigo-700 shadow-brand-sm hover:shadow-brand transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed'
            >
              {loading ? (
                <span className='flex items-center justify-center gap-2'>
                  <svg className='w-4 h-4 animate-spin' fill='none' viewBox='0 0 24 24'>
                    <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                    <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <div className='text-center pt-2 border-t border-slate-100'>
            <span className='text-sm text-slate-500'>Already have an account? </span>
            <button onClick={onGoToLogin} className='text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors'>
              Sign in here
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
