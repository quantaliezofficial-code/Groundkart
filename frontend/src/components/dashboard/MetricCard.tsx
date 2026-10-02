import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  description?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

export function MetricCard({ label, value, description, trend, isLoading }: MetricCardProps) {
  if (isLoading) {
    return <div className="shimmer h-[104px] rounded-2xl" />;
  }

  return (
    <div className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5 soft-lift transition-transform hover:-translate-y-0.5">
      <p className="font-sans text-xs uppercase tracking-wide text-on-surface-variant">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <p className="font-display text-2xl font-semibold text-pitch">{value}</p>
        {trend && (
          <span className={`font-sans text-sm font-medium mb-1 ${trend.isPositive ? 'text-primary-container' : 'text-clay'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 font-sans text-xs text-on-surface-variant">{description}</p>
      )}
    </div>
  );
}
