import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-surface-container border-dashed bg-surface-container-lowest py-16 px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mist text-pitch/60">
        <Icon size={32} />
      </div>
      <h3 className="mb-1 font-display text-lg font-semibold text-pitch">{title}</h3>
      <p className="mb-6 max-w-sm font-sans text-sm text-on-surface-variant">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
