import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: 'blue' | 'orange' | 'green' | 'purple';
  onClick?: () => void;
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
};

export function StatCard({ title, value, icon, color = 'blue', onClick }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border p-6 transition-all',
        onClick && 'cursor-pointer hover:shadow-md'
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

