'use client';

/**
 * 업무분장표 카드 컴포넌트 (법인별/개인별 업무 분장 표시)
 */

import { Building2, User, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkAssignment } from '@/lib/utils/parseWorkAssignment';

interface WorkAssignmentCardProps {
  assignment: WorkAssignment;
  onClick?: () => void;
  showSheetName?: boolean;
}

function getSheetColor(sheetName?: string): string {
  if (!sheetName) return '#971B2F'; // 기본 InBody Red
  
  // 시트명에 따라 색상 할당
  const colorMap: Record<string, string> = {
    'Entity': '#10B981', // Green
    'Task': '#3B82F6', // Blue
    '법인별': '#10B981',
    '개인별': '#3B82F6',
  };
  
  // 시트명이 colorMap에 있으면 해당 색상, 없으면 해시 기반 색상 생성
  if (colorMap[sheetName]) {
    return colorMap[sheetName];
  }
  
  // 해시 기반 색상 생성 (일관성 유지)
  const colors = [
    '#10B981', // Green
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#F59E0B', // Orange
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#EF4444', // Red
    '#14B8A6', // Teal
  ];
  
  let hash = 0;
  for (let i = 0; i < sheetName.length; i++) {
    hash = sheetName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function WorkAssignmentCard({ assignment, onClick, showSheetName = true }: WorkAssignmentCardProps) {
  const isEntityType = assignment.type === '법인별';
  const borderColor = getSheetColor(assignment.sheetName);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-l-4',
        onClick && 'hover:border-gray-300'
      )}
      style={{ borderLeftColor: borderColor }}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {showSheetName && assignment.sheetName && (
              <div className="mb-3">
                <div 
                  className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold"
                  style={{ 
                    backgroundColor: `${borderColor}15`,
                    color: borderColor,
                    border: `1px solid ${borderColor}40`
                  }}
                >
                  {assignment.sheetName}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              {isEntityType ? (
                <Building2 className="h-5 w-5" style={{ color: '#971B2F' }} />
              ) : (
                <User className="h-5 w-5" style={{ color: '#971B2F' }} />
              )}
              <CardTitle className="text-lg font-semibold text-gray-900">
                {assignment.name}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                className="text-xs"
                style={{ 
                  backgroundColor: 'rgba(151, 27, 47, 0.1)',
                  color: '#971B2F'
                }}
              >
                {assignment.type}
              </Badge>
              {assignment.department && (
                <Badge variant="outline" className="text-xs">
                  {assignment.department}
                </Badge>
              )}
              {assignment.entity && (
                <Badge variant="outline" className="text-xs">
                  {assignment.entity}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Briefcase className="h-4 w-4" />
            <span className="font-medium">담당 업무</span>
          </div>
          <ul className="space-y-1">
            {assignment.assignments.map((assignment, idx) => (
              <li 
                key={idx} 
                className="text-sm text-gray-700 flex items-start gap-2"
              >
                <span className="text-gray-400 mt-1">•</span>
                <span className="flex-1">{assignment}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
