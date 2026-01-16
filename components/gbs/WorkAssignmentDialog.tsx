'use client';

/**
 * 업무분장표 상세 정보 다이얼로그
 */

import { Building2, User, Briefcase, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WorkAssignment } from '@/lib/utils/parseWorkAssignment';

interface WorkAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  assignment: WorkAssignment | null;
}

export function WorkAssignmentDialog({ open, onClose, assignment }: WorkAssignmentDialogProps) {
  if (!assignment) return null;

  const isEntityType = assignment.type === '법인별';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              {isEntityType ? (
                <Building2 className="h-6 w-6" style={{ color: '#971B2F' }} />
              ) : (
                <User className="h-6 w-6" style={{ color: '#971B2F' }} />
              )}
              <span>{assignment.name}</span>
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  className="text-sm"
                  style={{
                    backgroundColor: 'rgba(151, 27, 47, 0.1)',
                    color: '#971B2F',
                  }}
                >
                  {assignment.type}
                </Badge>
                {assignment.sheetName && (
                  <Badge variant="outline" className="text-sm">
                    {assignment.sheetName}
                  </Badge>
                )}
                {assignment.fileName && (
                  <Badge variant="outline" className="text-sm text-gray-500">
                    {assignment.fileName}
                  </Badge>
                )}
              </div>

              {assignment.department && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">부서:</span>
                  <span className="text-sm text-gray-900">{assignment.department}</span>
                </div>
              )}

              {assignment.entity && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">법인 코드:</span>
                  <span className="text-sm text-gray-900">{assignment.entity}</span>
                </div>
              )}
            </div>

            {/* 담당 업무 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" style={{ color: '#971B2F' }} />
                <h3 className="text-lg font-semibold text-gray-900">담당 업무</h3>
                <Badge variant="outline" className="text-xs">
                  {assignment.assignments.length}개
                </Badge>
              </div>
              <ul className="space-y-2 pl-2">
                {assignment.assignments.map((task, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-700 flex items-start gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-gray-400 mt-1 font-bold">•</span>
                    <span className="flex-1">{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
