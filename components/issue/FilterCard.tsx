'use client';

import { cn } from '@/lib/utils';

interface FilterCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'orange' | 'green' | 'purple' | 'gray';
  onClick?: () => void;
  isActive?: boolean;
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  gray: 'bg-gray-50 text-gray-600',
};

const activeClasses = {
  blue: 'ring-2 ring-blue-500',
  orange: 'ring-2 ring-orange-500',
  green: 'ring-2 ring-green-500',
  purple: 'ring-2 ring-purple-500',
  gray: 'ring-2 ring-gray-500',
};

export function FilterCard({ title, value, icon, color = 'gray', onClick, isActive = false }: FilterCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border p-6 transition-all',
        onClick && 'cursor-pointer hover:shadow-md',
        isActive && activeClasses[color]
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={cn('p-3 rounded-lg', colorClasses[color])}>{icon}</div>
      </div>
    </div>
  );
}

