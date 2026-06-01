import React from 'react'
import { Card, CardContent } from '../../ui/Card'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Avatar } from '../../ui/Avatar'

export const CompatibilityCard = ({ user, score, onViewProfile }) => {
  const getScoreColor = (score) => {
    if (score >= 80) return 'success'
    if (score >= 60) return 'primary'
    if (score >= 40) return 'warning'
    return 'danger'
  }

  return (
    <Card className='hover:shadow-lg transition-shadow'>
      <CardContent>
        <div className='flex items-start justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <Avatar src={user.profileImage} alt={user.name} size='lg' />
            <div>
              <h3 className='font-semibold text-slate-900'>{user.name}</h3>
              <p className='text-sm text-slate-600'>{user.major}</p>
            </div>
          </div>
          <div className='text-right'>
            <Badge variant={getScoreColor(score)} className='text-lg font-bold'>
              {score}%
            </Badge>
            <p className='text-xs text-slate-600 mt-1'>Match</p>
          </div>
        </div>

        <p className='text-sm text-slate-600 mb-4'>{user.bio}</p>

        <div className='grid grid-cols-2 gap-2 mb-4 text-sm'>
          <div>
            <span className='text-slate-600'>Budget:</span>
            <p className='font-medium'>${user.preferences?.budget}</p>
          </div>
          <div>
            <span className='text-slate-600'>Quiet Hours:</span>
            <p className='font-medium'>{user.preferences?.quietHours?.length}h/day</p>
          </div>
        </div>

        <Button 
          onClick={() => onViewProfile(user.id)} 
          variant='primary' 
          size='sm' 
          className='w-full'
        >
          View Profile
        </Button>
      </CardContent>
    </Card>
  )
}
