import React from 'react';
import { Card, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CheckCircle2, Circle, Trash2 } from 'lucide-react';

export function ChoreCard({ chore, onToggle, onDelete, onAssign }) {
  const getFrequencyColor = (frequency) => {
    const colors = {
      daily: 'danger',
      'twice-weekly': 'warning',
      weekly: 'default',
      'bi-weekly': 'default'
    };
    return colors[frequency] || 'default';
  };

  const isOverdue = new Date(chore.dueDate) < new Date() && !chore.completed;

  return (
    <Card className={`hover:shadow-lg transition-all ${chore.completed ? 'opacity-75' : ''} ${isOverdue ? 'border-red-300' : ''}`}>
      <CardBody className="flex items-start gap-4">
        <button
          onClick={() => onToggle && onToggle(chore.id)}
          className="mt-1 text-indigo-600 hover:text-indigo-700 transition-colors"
          title={chore.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {chore.completed ? (
            <CheckCircle2 size={24} className="text-green-600" />
          ) : (
            <Circle size={24} />
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className={`font-semibold ${chore.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                {chore.title}
              </h3>
              <p className="text-sm text-slate-600">{chore.description}</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mb-3">
            <Badge variant={getFrequencyColor(chore.frequency)}>
              {chore.frequency}
            </Badge>
            {isOverdue && (
              <Badge variant="danger">
                Overdue
              </Badge>
            )}
            {chore.assignedTo && (
              <Badge variant="success">
                Assigned
              </Badge>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Due: {new Date(chore.dueDate).toLocaleDateString()}
          </div>
        </div>

        <button
          onClick={() => onDelete && onDelete(chore.id)}
          className="text-red-600 hover:text-red-700 transition-colors"
          title="Delete chore"
        >
          <Trash2 size={18} />
        </button>
      </CardBody>
    </Card>
  );
}
