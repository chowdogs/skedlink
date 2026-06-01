import React from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useSchedulePainter } from '../../controllers/useSchedulePainter';

export function SchedulePainter({ initialSchedule = {}, onSave, readOnly = false }) {
  const { schedule, toggleHour, ACTIVITIES, ACTIVITY_COLORS } = useSchedulePainter(initialSchedule);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour} ${period}`;
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">24-Hour Schedule</h3>
        <p className="text-sm text-slate-600 mb-4">Click on hours to assign activities</p>
      </div>

      <div className="grid grid-cols-6 gap-2 mb-6">
        {hours.map(hour => {
          const activity = schedule[hour] || 'sleep';
          return (
            <button
              key={hour}
              onClick={() => !readOnly && toggleHour(hour)}
              disabled={readOnly}
              className={`
                aspect-square rounded-lg font-medium text-white text-sm
                transition-all duration-200 hover:shadow-lg active:scale-95
                ${ACTIVITY_COLORS[activity]}
                ${readOnly ? 'cursor-default' : 'cursor-pointer'}
              `}
              title={activity}
            >
              <div className="text-xs">{formatHour(hour)}</div>
              <div className="text-xs capitalize mt-1">{activity}</div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {ACTIVITIES.map(activity => (
          <Badge key={activity} variant={activity}>
            {activity}
          </Badge>
        ))}
      </div>

      {!readOnly && onSave && (
        <Button onClick={() => onSave(schedule)} variant="primary">
          Save Schedule
        </Button>
      )}
    </div>
  );
}
