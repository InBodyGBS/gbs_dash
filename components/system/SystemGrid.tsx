'use client';

/**
 * System 현황 그리드 컴포넌트
 * 법인 × 시스템 카테고리 그리드
 * Calendar 탭의 카테고리를 드래그하여 셀에 드롭 가능
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Download, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import type { Subsidiary } from '@/lib/supabase/types';
import type { System, SystemCategory } from '@/lib/types/system';
import { updateSystemName, upsertSystem } from '@/lib/services/systemService';
import { exportSystemsToExcel } from '@/lib/utils/exportExcel';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ENTITY_ORDER_KEY = 'system-entity-order';
const CATEGORY_ORDER_KEY = 'system-category-order';

const SYSTEM_CATEGORIES: SystemCategory[] = [
  'ERP',
  'CRM',
  '물류',
  '회계',
  'CS',
  'Payroll',
  '생산관리',
  '기타',
];

// 상단에 표시할 시스템 목록 (색상 포함)
const SYSTEM_NAMES = [
  { id: 'D365', label: 'D365', color: '#3B82F6' }, // Blue
  { id: 'Odoo', label: 'Odoo', color: '#10B981' }, // Green
  { id: 'Zoho', label: 'Zoho', color: '#F59E0B' }, // Orange
  { id: '기타', label: '기타', color: '#6B7280' }, // Gray
] as const;

interface SystemGridProps {
  subsidiaries: Subsidiary[];
  systems: System[];
  onUpdate: () => void;
}

interface DroppableCellProps {
  entityId: string;
  category: SystemCategory;
  value: string | null;
  onSave: (entityId: string, category: SystemCategory, value: string | null) => Promise<void>;
  isSaving: boolean;
}

function DroppableCell({ entityId, category, value, onSave, isSaving }: DroppableCellProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 기타 시스템인 경우 직접 입력 모드
  const isOtherCategory = category === '기타';
  
  // system_name에 저장된 시스템 이름들을 파싱 (쉼표로 구분)
  // "기타" 또는 "기타(입력값)" 형식도 처리
  const systemNames = useMemo(() => {
    if (!value) return [];
    if (isOtherCategory) return [];
    const names = value.split(',').map(name => name.trim()).filter(Boolean);
    return names;
  }, [value, isOtherCategory]);

  // "기타" 시스템이 포함되어 있는지 확인 (기타 또는 기타(입력값) 형식)
  const hasOtherSystem = useMemo(() => {
    if (isOtherCategory) return false;
    return systemNames.some(name => name === '기타' || name.startsWith('기타('));
  }, [systemNames, isOtherCategory]);

  // "기타" 관련 시스템명 추출 (기타 또는 기타(입력값)에서 입력값만)
  const otherSystemName = useMemo(() => {
    if (!hasOtherSystem) return null;
    const otherItem = systemNames.find(name => name === '기타' || name.startsWith('기타('));
    if (!otherItem) return null;
    if (otherItem === '기타') return null; // 아직 입력값이 없음
    const match = otherItem.match(/기타\(([^)]+)\)/);
    return match ? match[1] : null;
  }, [systemNames, hasOtherSystem]);

  // "기타" 외의 다른 시스템 이름들
  const otherSystemNames = useMemo(() => {
    return systemNames.filter(name => name !== '기타' && !name.startsWith('기타('));
  }, [systemNames]);

  useEffect(() => {
    if (isOtherCategory) {
      setEditValue(value || '');
    } else if (hasOtherSystem) {
      // "기타" 시스템의 입력값 설정 (있으면 그 값, 없으면 빈 문자열)
      setEditValue(otherSystemName || '');
    } else {
      setEditValue('');
    }
  }, [value, isOtherCategory, hasOtherSystem, otherSystemName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    // 기타 열은 드롭 불가, 직접 입력만 가능
    if (isOtherCategory) return;

    const systemId = e.dataTransfer.getData('systemId');
    if (!systemId) return;

    // 기타 시스템인 경우: 추가하고 편집 모드로 전환
    if (systemId === '기타') {
      // 이미 "기타"가 있으면 편집 모드만 활성화, 없으면 추가하고 편집 모드 활성화
      if (!hasOtherSystem) {
        const newNames = [...systemNames, '기타'];
        const newValue = newNames.join(',');
        await onSave(entityId, category, newValue);
      }
      setIsEditing(true);
      return;
    }

    // 이미 포함되어 있으면 제거, 없으면 추가
    const newNames = systemNames.includes(systemId)
      ? systemNames.filter(name => name !== systemId)
      : [...systemNames, systemId];

    const newValue = newNames.length > 0 ? newNames.join(',') : null;
    await onSave(entityId, category, newValue);
  };

  const handleRemoveSystem = async (systemName: string) => {
    // "기타" 또는 "기타(입력값)" 형식 모두 제거
    const newNames = systemNames.filter(name => {
      if (name === systemName) return false;
      if (systemName === '기타' && (name === '기타' || name.startsWith('기타('))) return false;
      return true;
    });
    const newValue = newNames.length > 0 ? newNames.join(',') : null;
    await onSave(entityId, category, newValue);
    if (systemName === '기타' || systemName.startsWith('기타(')) {
      setIsEditing(false);
    }
  };

  const handleSave = async () => {
    if (isOtherCategory) {
      // 기타 열: 직접 입력한 값 저장
      const valueToSave = editValue.trim() || null;
      await onSave(entityId, category, valueToSave);
      setIsEditing(false);
    } else if (hasOtherSystem) {
      // 기타 시스템이 포함된 경우: 입력값만 저장 (기타 제거하고 입력값으로 대체)
      const inputText = editValue.trim();
      const otherNames = otherSystemNames;
      let newValue: string | null;
      
      if (inputText) {
        // 입력값이 있으면 "기타"를 입력값으로 대체
        const allNames = [...otherNames, inputText];
        newValue = allNames.join(',');
      } else {
        // 입력값이 없으면 "기타" 제거
        newValue = otherNames.length > 0 ? otherNames.join(',') : null;
      }
      
      await onSave(entityId, category, newValue);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      // 기타 시스템의 경우 저장된 값에서 입력값만 추출
      if (hasOtherSystem) {
        setEditValue(otherSystemName || '');
      } else {
        setEditValue(value || '');
      }
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (document.activeElement !== inputRef.current) {
        handleSave();
      }
    }, 200);
  };

  // 기타 카테고리는 직접 입력 모드
  if (isOtherCategory) {
    if (isEditing) {
      return (
        <div className="min-h-[60px] px-2 py-2">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="h-8 text-sm border-blue-500 focus:ring-2 focus:ring-blue-500"
            placeholder="시스템명 입력"
            disabled={isSaving}
          />
        </div>
      );
    }

    return (
      <div
        className={cn(
          'min-h-[60px] px-2 py-2 border-2 border-dashed rounded transition-colors cursor-pointer',
          'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        )}
        onClick={() => setIsEditing(true)}
        title="클릭하여 편집"
      >
        {value ? (
          <div className="text-sm text-gray-900">{value}</div>
        ) : (
          <div className="text-xs text-gray-400 text-center py-2">
            클릭하여 입력
          </div>
        )}
      </div>
    );
  }

  // 편집 모드 (기타 시스템이 포함된 경우)
  if (hasOtherSystem && isEditing) {
    return (
      <div className="h-full p-0 border-2 border-blue-500 rounded flex items-center">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="h-full text-sm border-0 focus:ring-0 px-2"
          placeholder="시스템명 입력"
          disabled={isSaving}
        />
      </div>
    );
  }

  // ERP, CRM, 물류, 회계, CS, Payroll, 생산관리는 드롭 가능
  return (
    <div
      className={cn(
        'h-full p-0 border-2 border-dashed rounded transition-colors flex',
        isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
        systemNames.length === 0 && 'border-gray-200'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {systemNames.length === 0 ? (
        <div className="text-xs text-transparent text-center w-full flex items-center justify-center">
          &nbsp;
        </div>
      ) : (
        <div className="flex flex-wrap gap-0 w-full h-full">
          {systemNames.map((systemName) => {
            // "기타" 또는 "기타(입력값)" 형식 처리
            const isOtherSystem = systemName === '기타' || systemName.startsWith('기타(');
            let displayName = systemName;
            let baseName = systemName;
            
            if (isOtherSystem) {
              if (systemName.startsWith('기타(')) {
                // "기타(입력값)" 형식에서 입력값만 추출하여 표시
                const match = systemName.match(/기타\(([^)]+)\)/);
                displayName = match ? match[1] : '기타';
                baseName = '기타';
              } else {
                displayName = '기타';
                baseName = '기타';
              }
            }
            
            const systemInfo = SYSTEM_NAMES.find(s => s.id === baseName);
            const systemColor = systemInfo?.color || '#6B7280';
            
            return (
              <div
                key={systemName}
                className={cn(
                  "group relative flex-1 min-w-0 flex items-center justify-center gap-0.5 px-0.5 text-sm rounded h-full",
                  isOtherSystem && "cursor-pointer"
                )}
                style={{
                  backgroundColor: `${systemColor}20`,
                  border: `1px solid ${systemColor}`,
                  color: systemColor,
                }}
                onClick={isOtherSystem ? () => setIsEditing(true) : undefined}
                title={isOtherSystem ? "클릭하여 시스템명 입력" : undefined}
              >
                <span className="truncate">{displayName}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSystem(systemName);
                  }}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 rounded px-0.5 text-red-600 font-bold text-base"
                  title="제거"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SystemGrid({ subsidiaries, systems, onUpdate }: SystemGridProps) {
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  
  // Entity 순서 관리
  const [orderedSubsidiaries, setOrderedSubsidiaries] = useState<Subsidiary[]>(subsidiaries);
  const [draggedEntityIndex, setDraggedEntityIndex] = useState<number | null>(null);

  // 시스템 순서 관리
  const [orderedSystems, setOrderedSystems] = useState<Array<typeof SYSTEM_NAMES[number]>>([...SYSTEM_NAMES]);
  const [draggedSystemIndex, setDraggedSystemIndex] = useState<number | null>(null);

  // localStorage에서 시스템 순서 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedOrder = localStorage.getItem(CATEGORY_ORDER_KEY);
      if (savedOrder) {
        const order: string[] = JSON.parse(savedOrder);
        const ordered = [...SYSTEM_NAMES].sort((a, b) => {
          const indexA = order.indexOf(a.id);
          const indexB = order.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
        setOrderedSystems(ordered);
      }
    } catch (error) {
      console.error('Failed to load system order:', error);
    }
  }, []);

  // Entity 순서 적용
  const applyEntityOrder = useCallback((subs: Subsidiary[]): Subsidiary[] => {
    if (typeof window === 'undefined') return subs;
    try {
      const savedOrder = localStorage.getItem(ENTITY_ORDER_KEY);
      if (savedOrder) {
        const order: string[] = JSON.parse(savedOrder);
        const ordered = [...subs].sort((a, b) => {
          const indexA = order.indexOf(a.id);
          const indexB = order.indexOf(b.id);
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

  // 시스템 순서 저장
  const saveSystemOrder = useCallback((order: Array<typeof SYSTEM_NAMES[number]>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(order.map(sys => sys.id)));
      toast.success('시스템 순서가 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save system order:', error);
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

  // 시스템 드래그 핸들러
  const handleSystemDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSystemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('systemIndex', index.toString());
    e.dataTransfer.setData('systemId', orderedSystems[index].id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleSystemDragEnd = (e: React.DragEvent) => {
    setDraggedSystemIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    saveSystemOrder(orderedSystems);
  };

  const handleSystemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedIndex = draggedSystemIndex;
    if (draggedIndex !== null && draggedIndex !== index) {
      const newOrder = [...orderedSystems];
      [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
      setOrderedSystems(newOrder);
      setDraggedSystemIndex(index);
    }
  };

  const handleSystemDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedIndex = parseInt(e.dataTransfer.getData('systemIndex'));
    if (!isNaN(draggedIndex) && draggedIndex !== index) {
      const newOrder = [...orderedSystems];
      [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
      setOrderedSystems(newOrder);
      saveSystemOrder(newOrder);
    }
    setDraggedSystemIndex(null);
  };

  // 필터링된 법인 목록 (orderedSubsidiaries 기준)
  const filteredSubsidiaries = useMemo(() => {
    let filtered = [...orderedSubsidiaries];

    // 지역 필터
    if (regionFilter !== 'all') {
      filtered = filtered.filter((sub) => sub.region === regionFilter);
    }

    // 시스템 필터
    if (systemFilter !== 'all') {
      filtered = filtered.filter((sub) => {
        return SYSTEM_CATEGORIES.some((category) => {
          const key = `${sub.id}_${category}`;
          const system = systemsMap.get(key);
          if (!system?.system_name) return false;
          const systemNames = system.system_name.split(',').map(n => n.trim());
          return systemNames.includes(systemFilter);
        });
      });
    }

    return filtered;
  }, [orderedSubsidiaries, regionFilter, systemFilter, systemsMap]);

  // 셀 저장 핸들러
  const handleCellSave = useCallback(
    async (entityId: string, category: SystemCategory, value: string | null) => {
      const key = `${entityId}_${category}`;
      setSavingCells((prev) => new Set(prev).add(key));

      try {
        await updateSystemName(entityId, category, value);
        onUpdate();
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
    <div className="space-y-4 h-full flex flex-col">
      {/* 필터 */}
      <div className="flex items-center gap-4">
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
        <Select value={systemFilter} onValueChange={setSystemFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="시스템 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 시스템</SelectItem>
            <SelectItem value="D365">D365</SelectItem>
            <SelectItem value="Odoo">Odoo</SelectItem>
            <SelectItem value="Zoho">Zoho</SelectItem>
            <SelectItem value="기타">기타</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExportExcel}>
          <Download className="w-4 h-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* 상단 시스템 (드래그 가능) */}
      <div className="bg-gray-50 p-4 rounded-lg border">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">시스템</h3>
        <div className="flex flex-wrap gap-2">
          {orderedSystems.map((system, index) => (
            <div
              key={system.id}
              draggable={true}
              onDragStart={(e) => handleSystemDragStart(e, index)}
              onDragEnd={handleSystemDragEnd}
              onDragOver={(e) => handleSystemDragOver(e, index)}
              onDrop={(e) => handleSystemDrop(e, index)}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all border-2 cursor-move hover:shadow-md',
                draggedSystemIndex === index && 'opacity-50'
              )}
              style={{
                backgroundColor: `${system.color}20`,
                borderColor: system.color,
              }}
            >
              <GripVertical className="w-4 h-4 text-gray-400" />
              <span
                className="text-sm font-medium"
                style={{ color: system.color }}
              >
                {system.label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 시스템을 드래그하여 그리드 셀에 드롭하세요 (기타는 직접 입력)
        </p>
      </div>

      {/* 그리드 테이블 */}
      <div className="border rounded-lg overflow-hidden bg-white flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-50 border-b">
                <th className="px-0.5 py-1.6 text-left text-sm font-semibold text-gray-900 border-r sticky left-0 bg-gray-50 z-30 w-[60px]">
                  Entity
                </th>
                {SYSTEM_CATEGORIES.map((category) => (
                  <th
                    key={category}
                    className="px-1 py-1.6 text-center text-sm font-semibold text-gray-900 min-w-[80px] w-[80px]"
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
                  <td className="px-0.5 py-1.2 text-sm font-medium text-gray-900 border-r sticky left-0 bg-white z-10 w-[60px]">
                    <div className="flex items-center gap-0.5">
                      <GripVertical className="h-3 w-3 text-gray-400 cursor-move flex-shrink-0" />
                      <div className="font-semibold truncate">{subsidiary.name}</div>
                    </div>
                  </td>
                  {SYSTEM_CATEGORIES.map((category) => {
                    const key = `${subsidiary.id}_${category}`;
                    const system = systemsMap.get(key);
                    const isSaving = savingCells.has(key);

                    return (
                      <td key={category} className="px-1 py-1.2 h-[40px] w-[80px]">
                        <DroppableCell
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
