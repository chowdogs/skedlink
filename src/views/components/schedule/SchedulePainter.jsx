import React, { useState } from 'react'
import { DAYS, CUSTOM_PALETTE } from '../../../controllers/useSchedulePainter'

const DAY_LABELS = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' }
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const to12h = (h) => {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

const NOW_DAY = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]
const NOW_HOUR = new Date().getHours()

export const SchedulePainter = ({
  schedule, onHourChange, currentActivity, onActivityChange,
  allActivities, getActivityHex,
  onAddCustomActivity, onRemoveCustomActivity, customActivities
}) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(CUSTOM_PALETTE[0])

  const handleAddActivity = async () => {
    if (!newLabel.trim()) return
    await onAddCustomActivity(newLabel.trim(), newColor)
    setNewLabel('')
    setNewColor(CUSTOM_PALETTE[0])
    setShowAddForm(false)
  }

  return (
    <div className='space-y-6'>
      {/* Activity Legend */}
      <div>
        <h3 className='text-base font-bold text-slate-900 mb-2'>Activity</h3>
        <p className='text-xs text-slate-500 mb-2.5'>
          <i className='bi bi-1-circle mr-1 text-indigo-500' /> Pick an activity below,
          then <span className='font-semibold text-slate-700'>click or drag</span> on the grid to paint.
        </p>
        <div className='flex flex-wrap gap-2'>
          {allActivities.map(act => (
            <div key={act.id} className='flex items-center gap-1'>
              <button
                type='button'
                onClick={() => onActivityChange(act.id)}
                style={{
                  backgroundColor: act.hex,
                  opacity: currentActivity === act.id ? 1 : 0.45,
                  transform: currentActivity === act.id ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: currentActivity === act.id ? `0 4px 14px ${act.hex}66` : 'none'
                }}
                className='px-3.5 py-1.5 rounded-lg text-white text-sm font-semibold transition-all'
              >
                {act.label}
              </button>
              {customActivities?.some(c => c.id === act.id) && (
                <button
                  type='button'
                  onClick={() => onRemoveCustomActivity(act.id)}
                  className='w-4 h-4 rounded-full bg-slate-200 hover:bg-red-400 text-slate-600 hover:text-white text-xs flex items-center justify-center transition-colors'
                  title='Remove activity'
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button
            type='button'
            onClick={() => setShowAddForm(v => !v)}
            className='px-3.5 py-1.5 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors'
          >
            + Add Activity
          </button>
        </div>

        {showAddForm && (
          <div className='mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-end'>
            <div>
              <label className='text-xs font-medium text-slate-600 block mb-1'>Activity Name</label>
              <input
                type='text'
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddActivity()}
                placeholder='e.g. Gym, Reading, Part-time Job...'
                className='px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
              />
            </div>
            <div>
              <label className='text-xs font-medium text-slate-600 block mb-1'>Color</label>
              <div className='flex gap-1'>
                {CUSTOM_PALETTE.map(hex => (
                  <button
                    key={hex}
                    type='button'
                    onClick={() => setNewColor(hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-6 h-6 rounded-full transition-transform ${newColor === hex ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : ''}`}
                  />
                ))}
              </div>
            </div>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={handleAddActivity}
                style={{ backgroundColor: newColor }}
                className='px-4 py-1.5 rounded-lg text-white text-sm font-medium'
              >
                Add
              </button>
              <button
                type='button'
                onClick={() => setShowAddForm(false)}
                className='px-4 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300'
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 7-day × 24-hour Grid */}
      <div>
        <h3 className='text-base font-bold text-slate-900 mb-1'>Weekly Schedule</h3>
        <div className='overflow-x-auto pb-1'>
          <div className='min-w-max'>
            {/* Hour header */}
            <div className='flex mb-1'>
              <div className='w-12 shrink-0' />
              {HOURS.map(h => (
                <div
                  key={h}
                  className='text-center leading-none shrink-0'
                  style={{ width: 36 }}
                >
                  {h % 3 === 0 ? (
                    <span className='text-[9px] text-slate-400 font-medium'>{to12h(h)}</span>
                  ) : ''}
                </div>
              ))}
            </div>

            {/* Day rows */}
            {DAYS.map(day => (
              <div key={day} className='flex items-center mb-1'>
                <div className='w-12 shrink-0 text-xs font-bold text-slate-500 pr-2 text-right'>
                  {DAY_LABELS[day]}
                  {day === NOW_DAY && (
                    <span className='block text-[8px] text-indigo-500 font-bold'>Today</span>
                  )}
                </div>
                {HOURS.map(h => {
                  const actId = schedule?.[day]?.[h] || 'dayoff'
                  const hex = getActivityHex(actId)
                  const isNow = day === NOW_DAY && h === NOW_HOUR
                  const isNoon = h === 12
                  return (
                    <button
                      key={h}
                      type='button'
                      onClick={() => onHourChange(day, h, currentActivity)}
                      onMouseEnter={(e) => { if (e.buttons === 1) onHourChange(day, h, currentActivity) }}
                      style={{
                        backgroundColor: hex,
                        width: 36,
                        height: 32,
                        marginLeft: isNoon ? 3 : 0,
                      }}
                      className={`rounded-sm transition-opacity hover:opacity-80 active:scale-95 shrink-0 ${
                        isNow ? 'ring-2 ring-white ring-inset' : ''
                      }`}
                      title={`${DAY_LABELS[day]} ${to12h(h)}${h < 23 ? '–' + to12h(h + 1) : ''}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className='mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-slate-400 pl-12'>
          <span><span className='font-semibold text-slate-500'>12am</span> — Midnight</span>
          <span><span className='font-semibold text-slate-500'>6am</span> — Morning</span>
          <span><span className='font-semibold text-slate-500'>12pm</span> — Noon · gap marks the split</span>
          <span><span className='font-semibold text-slate-500'>6pm</span> — Evening</span>
        </div>
        <p className='text-[10px] text-indigo-500 mt-1 pl-12'>
          <i className='bi bi-circle-fill text-[6px] align-middle mr-1' />White ring = current hour
        </p>
      </div>

      {/* Weekly Summary */}
      <div>
        <h3 className='text-base font-bold text-slate-900 mb-3'>Weekly Summary</h3>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          {allActivities.map(act => {
            let count = 0
            DAYS.forEach(day => {
              Object.values(schedule?.[day] || {}).forEach(a => { if (a === act.id) count++ })
            })
            return (
              <div key={act.id} className='bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2'>
                <div className='w-3 h-3 rounded-full shrink-0' style={{ backgroundColor: act.hex }} />
                <span className='text-sm font-medium text-slate-800 truncate'>{act.label}:</span>
                <span className='text-sm font-bold text-slate-600 ml-auto'>{count}h</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
