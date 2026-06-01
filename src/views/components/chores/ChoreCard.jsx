import React from 'react'
import { Card, CardContent } from '../../ui/Card'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'

export const ChoreCard = ({ chore, onToggle, onAssign }) => {
  const getPriorityVariant = (priority) => {
    if (priority === 'high') return 'danger'
    if (priority === 'medium') return 'warning'
    return 'slate'
  }

  return (
    <Card className={`${chore.completed ? 'opacity-60' : ''}`}>
      <CardContent>
        <div className='flex items-start justify-between mb-3'>
          <div className='flex-1'>
            <h3 className={`font-semibold ${chore.completed ? 'line-through text-slate-600' : 'text-slate-900'}`}>
              {chore.title}
            </h3>
            <p className='text-sm text-slate-600 mt-1'>{chore.description}</p>
          </div>
          <div className='flex gap-2'>
            <Badge variant={getPriorityVariant(chore.priority)} className='capitalize'>
              {chore.priority}
            </Badge>
            {chore.completed && <Badge variant='success'>Done</Badge>}
          </div>
        </div>

        <div className='grid grid-cols-3 gap-2 mb-4 text-sm text-slate-600'>
          <div>
            <span className='text-xs text-slate-500'>Time:</span>
            <p className='font-medium'>{chore.estimatedTime}</p>
          </div>
          <div>
            <span className='text-xs text-slate-500'>Frequency:</span>
            <p className='font-medium capitalize'>{chore.frequency}</p>
          </div>
          <div>
            <span className='text-xs text-slate-500'>Due:</span>
            <p className='font-medium'>{new Date(chore.dueDate).toLocaleDateString()}</p>
          </div>
        </div>

        <div className='flex gap-2'>
          <Button
            onClick={() => onToggle(chore.id)}
            variant={chore.completed ? 'secondary' : 'primary'}
            size='sm'
            className='flex-1'
          >
            {chore.completed ? 'Mark Pending' : 'Mark Done'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
