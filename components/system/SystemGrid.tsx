'use client';

/**
 * System 현황 그리드 컴포넌트
 * 법인 × 시스템 카테고리 그리드
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import type { Subsidiary } from '@/lib/supabase/types';
import type { System, SystemCategory } from '@/lib/types/system';
import { updateSystemName } from '@/lib/services/systemService';
import { exportSystemsToExcel } from '@/lib/utils/exportExcel';
import { cn } from '@/lib/utils';

const ENTITY_ORDER_KEY = 'system-entity-order';

const SYSTEM_CATEGORIES: SystemCategory[] = [
  'ERP',
  'CRM',
  '생산관리',
  '물류',
  '회계',
  'CS',
  'Payroll',
  '기타',
];

interface SystemGridProps {
  subsidiaries: Subsidiary[];
  systems: System[];
  onUpdate: () => void;
}

interface EditableCellProps {
  entityId: string;
  category: SystemCategory;
  value: string | null;
  onSave: (entityId: string, category: SystemCategory, value: string | null) => Promise<void>;
  isSaving: boolean;
}

function EditableCell({ entityId, category, value, onSave, isSaving }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setEditValue(value || '');
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaving(true);
    try {
      await onSave(entityId, category, editValue.trim() || null);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('저장 실패');
      setEditValue(value || '');
    } finally {
      setSaving(false);
    }
  }, [entityId, category, editValue, onSave, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value || '');
      setIsEditing(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleBlur = () => {
    // 약간의 지연을 두어 클릭 이벤트가 처리되도록
    setTimeout(() => {
      if (document.activeElement !== inputRef.current) {
        handleSave();
      }
    }, 200);
  };

  if (isEditing) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="h-8 text-sm border-blue-500 focus:ring-2 focus:ring-blue-500"
          disabled={saving}
        />
        {saving && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-8 px-2 py-1 text-sm cursor-pointer hover:bg-blue-50 hover:border-blue-200 border border-transparent rounded flex items-center',
        value ? 'text-gray-900' : 'text-gray-400 italic'
      )}
      onClick={() => setIsEditing(true)}
      title="클릭하여 편집"
    >
      {value || '(비어있음)'}
    </div>
  );
}

export function SystemGrid({ subsidiaries, systems, onUpdate }: SystemGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  
  // Entity 순서 관리
  const [orderedSubsidiaries, setOrderedSubsidiaries] = useState<Subsidiary[]>(subsidiaries);
  const [draggedEntityIndex, setDraggedEntityIndex] = useState<number | null>(null);

  // Entity 순서 적용
  const applyEntityOrder = useCallback((subs: Subsidiary[]): Subsidiary[] => {
    if (typeof window === 'undefined') return subs;
    try {
      const savedOrder = localStorage.getItem(ENTITY_ORDER_KEY);
      if (savedOrder) {
        const order: string[] = JSON.parse(savedOrder);
        // 순서에 따라 정렬
        const ordered = [...subs].sort((a, b) => {
          const indexA = order.indexOf(a.id);
          const indexB = order.indexOf(b.id);
          // 순서에 없는 항목은 뒤로
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
        return ordered;
      }
    } catch (error) {
      console.error('Failed to load entity order:', error);
    }
    return subs;
  }, []);

  // Entity 순서 저장
  const saveEntityOrder = useCallback((order: string[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(ENTITY_ORDER_KEY, JSON.stringify(order));
    } catch (error) {
      console.error('Failed to save entity order:', error);
    }
  }, []);

  // subsidiaries가 변경되면 orderedSubsidiaries 업데이트
  useEffect(() => {
    const ordered = applyEntityOrder(subsidiaries);
    setOrderedSubsidiaries(ordered);
  }, [subsidiaries, applyEntityOrder]);

  // 시스템 데이터를 맵으로 변환 (entity_id + category → System)
  const systemsMap = useMemo(() => {
    const map = new Map<string, System>();
    systems.forEach((system) => {
      const key = `${system.entity_id}_${system.category}`;
      map.set(key, system);
    });
    return map;
  }, [systems]);

  // Entity 드래그 핸들러
  const handleEntityDragStart = (e: React.DragEvent, index: number) => {
    setDraggedEntityIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('entityIndex', index.toString());
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleEntityDragEnd = (e: React.DragEvent) => {
    setDraggedEntityIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleEntityDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedIndex = draggedEntityIndex;
    if (draggedIndex !== null && draggedIndex !== index) {
      const newOrder = [...orderedSubsidiaries];
      [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
      setOrderedSubsidiaries(newOrder);
      setDraggedEntityIndex(index);
    }
  };

  const handleEntityDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedIndex = parseInt(e.dataTransfer.getData('entityIndex'));
    if (!isNaN(draggedIndex) && draggedIndex !== index) {
      const newOrder = [...orderedSubsidiaries];
      [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
      setOrderedSubsidiaries(newOrder);
      saveEntityOrder(newOrder.map(s => s.id));
      toast.success('Entity 순서가 저장되었습니다.');
    }
    setDraggedEntityIndex(null);
  };

  // 필터링된 법인 목록 (orderedSubsidiaries 기준)
  const filteredSubsidiaries = useMemo(() => {
    let filtered = [...orderedSubsidiaries];

    // 지역 필터
    if (regionFilter !== 'all') {
      filtered = filtered.filter((sub) => sub.region === regionFilter);
    }

    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (sub) =>
          sub.name.toLowerCase().includes(query) ||
          sub.code.toLowerCase().includes(query) ||
          sub.country.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [orderedSubsidiaries, regionFilter, searchQuery]);

  // 셀 저장 핸들러
  const handleCellSave = useCallback(
    async (entityId: string, category: SystemCategory, value: string | null) => {
      const key = `${entityId}_${category}`;
      setSavingCells((prev) => new Set(prev).add(key));

      try {
        await updateSystemName(entityId, category, value);
        onUpdate();
        toast.success('저장되었습니다');
      } catch (error) {
        console.error('Failed to save system:', error);
        toast.error('저장 실패');
        throw error;
      } finally {
        setSavingCells((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [onUpdate]
  );

  // Excel 다운로드
  const handleExportExcel = () => {
    try {
      exportSystemsToExcel(subsidiaries, systems, SYSTEM_CATEGORIES);
      toast.success('Excel 파일이 다운로드되었습니다');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Excel 다운로드 실패');
    }
  };

  return (
    <div className="space-y-4">
      {/* 필터 및 검색 */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="법인명, 코드, 국가로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="지역 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 지역</SelectItem>
            <SelectItem value="Americas">Americas</SelectItem>
            <SelectItem value="Europe">Europe</SelectItem>
            <SelectItem value="Asia-Pacific">Asia-Pacific</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExportExcel}>
          <Download className="w-4 h-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* 그리드 테이블 */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-r sticky left-0 bg-gray-50 z-10 min-w-[120px]">
                  Entity
                </th>
                {SYSTEM_CATEGORIES.map((category) => (
                  <th
                    key={category}
                    className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px]"
                  >
                    {category}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSubsidiaries.map((subsidiary, entityIndex) => (
                <tr 
                  key={subsidiary.id} 
                  className="border-b hover:bg-gray-50"
                  draggable
                  onDragStart={(e) => handleEntityDragStart(e, entityIndex)}
                  onDragEnd={handleEntityDragEnd}
                  onDragOver={(e) => handleEntityDragOver(e, entityIndex)}
                  onDrop={(e) => handleEntityDrop(e, entityIndex)}
                >
                  <td className="px-2 py-2 text-sm font-medium text-gray-900 border-r sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-move flex-shrink-0" />
                      <div>
                        <div className="font-semibold">{subsidiary.name}</div>
                        <div className="text-xs text-gray-500">{subsidiary.code}</div>
                      </div>
                    </div>
                  </td>
                  {SYSTEM_CATEGORIES.map((category) => {
                    const key = `${subsidiary.id}_${category}`;
                    const system = systemsMap.get(key);
                    const isSaving = savingCells.has(key);

                    return (
                      <td key={category} className="px-2 py-1">
                        <EditableCell
                          entityId={subsidiary.id}
                          category={category}
                          value={system?.system_name || null}
                          onSave={handleCellSave}
                          isSaving={isSaving}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredSubsidiaries.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>표시할 법인이 없습니다</p>
        </div>
      )}
    </div>
  );
}

