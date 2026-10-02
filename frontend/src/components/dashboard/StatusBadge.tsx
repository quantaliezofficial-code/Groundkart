import React from 'react';

export type StatusType = 
  | 'active' 
  | 'approved' 
  | 'pending_review' 
  | 'pending' 
  | 'suspended' 
  | 'rejected' 
  | 'draft'
  | 'confirmed'
  | 'pending_payment'
  | 'cancelled'
  | 'completed';

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_BADGE_STYLE: Record<string, string> = {
  active: 'bg-primary-container/10 text-primary-container border-primary-container/20',
  approved: 'bg-primary-container/10 text-primary-container border-primary-container/20',
  confirmed: 'bg-primary-container/10 text-primary-container border-primary-container/20',
  completed: 'bg-primary-container/10 text-primary-container border-primary-container/20',
  
  pending_review: 'bg-marigold/10 text-pitch border-marigold/30',
  pending: 'bg-marigold/10 text-pitch border-marigold/30',
  pending_payment: 'bg-marigold/10 text-pitch border-marigold/30',
  
  suspended: 'bg-clay/10 text-clay border-clay/20',
  rejected: 'bg-clay/10 text-clay border-clay/20',
  cancelled: 'bg-clay/10 text-clay border-clay/20',
  
  draft: 'bg-surface-container-high text-on-surface-variant border-surface-container-highest',
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const style = STATUS_BADGE_STYLE[normalizedStatus] ?? 'bg-surface-container-high text-on-surface-variant border-surface-container-highest';
  
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-sans text-xs font-medium capitalize tracking-wide ${style} ${className}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
