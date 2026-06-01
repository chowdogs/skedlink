import React from 'react';
import { Card, CardBody } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Heart, MessageCircle } from 'lucide-react';

export function CompatibilityCard({ user, score, onConnect }) {
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent Match';
    if (score >= 60) return 'Good Match';
    if (score >= 40) return 'Okay Match';
    return 'Low Match';
  };

  return (
    <Card className="hover:shadow-xl transition-all">
      <CardBody className="flex gap-4">
        <Avatar name={user.name} size="lg" />
        
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-slate-900">{user.name}</h3>
              <p className="text-sm text-slate-600">{user.email}</p>
            </div>
            <div className={`text-right ${getScoreColor(score)}`}>
              <div className="text-2xl font-bold">{score}%</div>
              <div className="text-xs font-medium">{getScoreLabel(score)}</div>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <Badge variant={score >= 60 ? 'success' : 'default'}>
              Schedule Match
            </Badge>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="primary" 
              onClick={() => onConnect && onConnect(user)}
              className="flex-1 text-sm flex items-center justify-center gap-2"
            >
              <Heart size={16} />
              Connect
            </Button>
            <Button 
              variant="secondary" 
              className="flex-1 text-sm flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} />
              Message
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
