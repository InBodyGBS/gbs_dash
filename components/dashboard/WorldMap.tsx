'use client';

/**
 * 세계지도 컴포넌트
 * react-simple-maps를 사용하여 법인 위치를 마커로 표시
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Plus, Minus } from 'lucide-react';
import { Subsidiary } from '@/lib/supabase/types';
import { REGION_COLORS } from '@/lib/constants/regions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface WorldMapProps {
  subsidiaries: Subsidiary[];
  selectedId?: string | null;
  onSubsidiaryClick: (id: string) => void;
}

// 국가별 그룹화 타입
interface CountryGroup {
  country: string;
  latitude: number;
  longitude: number;
  subsidiaries: Subsidiary[];
  region: string;
}

/**
 * 세계지도 기반 법인 위치 시각화
 * 지역별 색상 구분 및 클릭 인터랙션 제공
 * 같은 국가에 여러 법인이 있으면 그룹화하여 표시
 */
export const WorldMap = ({ subsidiaries, selectedId, onSubsidiaryClick }: WorldMapProps) => {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [markersVisible, setMarkersVisible] = useState(false);

  // 국가별로 법인 그룹화 (같은 국가, 비슷한 좌표 기준)
  const countryGroups = useMemo(() => {
    const groups = new Map<string, CountryGroup>();

    subsidiaries.forEach((sub) => {
      // 국가 키 생성 (국가명 + 반올림된 좌표로 그룹화)
      const latRounded = Math.round(sub.latitude * 10) / 10;
      const lngRounded = Math.round(sub.longitude * 10) / 10;
      const countryKey = `${sub.country}_${latRounded}_${lngRounded}`;

      if (groups.has(countryKey)) {
        const group = groups.get(countryKey)!;
        group.subsidiaries.push(sub);
        // 평균 좌표 계산
        const totalLat = group.subsidiaries.reduce((sum, s) => sum + s.latitude, 0);
        const totalLng = group.subsidiaries.reduce((sum, s) => sum + s.longitude, 0);
        group.latitude = totalLat / group.subsidiaries.length;
        group.longitude = totalLng / group.subsidiaries.length;
      } else {
        groups.set(countryKey, {
          country: sub.country,
          latitude: sub.latitude,
          longitude: sub.longitude,
          subsidiaries: [sub],
          region: sub.region,
        });
      }
    });

    return Array.from(groups.values());
  }, [subsidiaries]);

  // 레이블 위치 offset 계산 (겹침 방지 - 위아래로 분리)
  const labelOffsets = useMemo(() => {
    const offsets: Array<{ x: number; y: number; yOffset: number }> = [];
    const threshold = 3.0; // 약 3도 이내면 가까운 것으로 간주
    const verticalSpacing = 1.2; // 위아래 간격 (도 단위)

    // 가까운 그룹들을 클러스터로 묶기
    const clusters: number[][] = [];
    const assigned = new Set<number>();

    countryGroups.forEach((group, index) => {
      if (assigned.has(index)) return;

      const cluster = [index];
      assigned.add(index);

      // 같은 클러스터에 속하는 그룹 찾기
      countryGroups.forEach((otherGroup, otherIndex) => {
        if (index === otherIndex || assigned.has(otherIndex)) return;

        const latDiff = Math.abs(group.latitude - otherGroup.latitude);
        const lngDiff = Math.abs(group.longitude - otherGroup.longitude);
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

        if (distance < threshold) {
          cluster.push(otherIndex);
          assigned.add(otherIndex);
        }
      });

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    });

    // 각 그룹에 offset 적용
    countryGroups.forEach((group, index) => {
      let offsetX = 0;
      let offsetY = 0;
      let yOffset = 0; // 레이블 y 위치 offset (픽셀 단위)

      // 클러스터 내에서의 위치 찾기
      for (const cluster of clusters) {
        const clusterIndex = cluster.indexOf(index);
        if (clusterIndex !== -1) {
          // 클러스터 내에서 위아래로 순차 배치
          const totalInCluster = cluster.length;
          const position = clusterIndex - (totalInCluster - 1) / 2; // 중앙 기준 위치
          
          // 위아래로 분리 (y축 offset만 적용)
          offsetY = position * verticalSpacing;
          yOffset = position * 8; // 레이블 y 위치도 조정 (픽셀 단위)
          
          // 약간의 좌우 offset도 추가하여 더 명확하게 분리
          offsetX = position % 2 === 0 ? 0.3 : -0.3;
          break;
        }
      }

      offsets.push({ x: offsetX, y: offsetY, yOffset });
    });

    return offsets;
  }, [countryGroups]);

  // ✅ 훨씬 더 타이트한 지도 비율 + 팝업 열릴 때 동적 조정
  const mapConfig = useMemo(() => {
    if (countryGroups.length === 0) {
      return { scale: 180, center: [30, 20] as [number, number] };
    }

    // 모든 법인의 좌표 범위 계산
    const lats = countryGroups.map((g) => g.latitude);
    const lngs = countryGroups.map((g) => g.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // 중심점 계산
    const centerLat = (minLat + maxLat) / 2;
    let centerLng = (minLng + maxLng) / 2;

    // ✅ 지도 중심을 유럽-아시아 지역으로 조정 (동쪽으로 오프셋)
    // 데이터가 주로 유럽-아시아에 있으므로 경도에 오프셋 추가
    // 오프셋은 데이터 분포에 따라 조정 (10~20도 정도)
    const lngRange = maxLng - minLng;
    const lngOffset = Math.min(15, lngRange * 0.3); // 최대 15도, 또는 범위의 30%
    centerLng = centerLng + lngOffset;

    // ✅ 팝업이 열리면 서쪽으로 이동 (왼쪽으로 이동)
    if (selectedId) {
      centerLng = centerLng + 40;
    }

    // ✅ 여백을 거의 없게 (5%만)
    const latRange = (maxLat - minLat) * 1.05;
    const adjustedLngRange = (maxLng - minLng) * 1.05;

    // ✅ 훨씬 더 큰 scale로 (데이터가 화면을 가득 채우도록)
    const maxRange = Math.max(latRange, adjustedLngRange);
    
    // scale을 크게 증가
    let scale = 200; // 기본값 증가
    if (maxRange > 0) {
      // 범위가 클수록 scale이 작아지지만, 최소값을 높게 설정
      scale = Math.max(180, Math.min(400, 3000 / maxRange));
    }

    // ✅ 팝업이 열리면 축소
    if (selectedId) {
      scale = scale * 0.85;
    }

    console.log('🗺️ Map Config:', { scale, center: [centerLng, centerLat], latRange, lngRange, selectedId });

    return {
      scale,
      center: [centerLng, centerLat] as [number, number],
    };
  }, [countryGroups, selectedId]);

  // 마커 hover 시 화면 좌표 계산
  const handleMarkerMouseEnter = (
    e: React.MouseEvent<SVGCircleElement>,
    groupKey: string
  ) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setHoverPosition({ x, y });
      setHoveredGroup(groupKey);
    }
  };

  const handleMarkerMouseLeave = () => {
    // 약간의 지연을 두어 오버레이로 이동할 시간을 줌
    setTimeout(() => {
      // 오버레이 위에 마우스가 있는지 확인
      const overlay = document.querySelector('[data-entity-overlay]');
      if (!overlay || !overlay.matches(':hover')) {
        setHoveredGroup(null);
        setHoverPosition(null);
      }
    }, 100);
  };

  // 페이지 로드 시 마커 fadeIn 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setMarkersVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // 확대/축소 핸들러
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0f0f23] relative overflow-hidden">
      {/* ✅ 수정: clipPath 제거하여 여백 최소화 */}
      <div className="absolute inset-0">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: mapConfig.scale * zoom,
            center: mapConfig.center,
          }}
          className="w-full h-full transition-all duration-500 ease-in-out"
          style={{ width: '100%', height: '100%' }}
        >
          {/* 세계지도 배경 - 다크 테마 */}
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1a1a2e"
                  stroke="#2d2d44"
                  strokeWidth={0.3}
                  style={{
                    default: { 
                      outline: 'none',
                      transition: 'all 0.2s ease',
                    },
                    hover: { 
                      outline: 'none', 
                      fill: '#252540',
                      stroke: '#3d3d54',
                    },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* 1단계: 모든 원형 마커 먼저 렌더링 */}
          {countryGroups.map((group, groupIndex) => {
            const hasMultiple = group.subsidiaries.length > 1;
            const isAnySelected = group.subsidiaries.some((sub) => sub.id === selectedId);
            const markerColor = REGION_COLORS[group.region] || '#3B82F6';
            const groupKey = `group-${groupIndex}`;

            return (
              <Marker key={groupKey} coordinates={[group.longitude, group.latitude]}>
                <g>
                  {/* 원형 마커 - fadeIn 애니메이션 */}
                  <circle
                    r={isAnySelected ? 10 : hasMultiple ? 8 : 7}
                    fill={markerColor}
                    stroke={isAnySelected ? '#1f2937' : 'transparent'}
                    strokeWidth={2}
                    className={cn(
                      'cursor-pointer transition-all duration-300 ease-out',
                      markersVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-0',
                      'hover:scale-110'
                    )}
                    style={{
                      transitionDelay: `${groupIndex * 50}ms`,
                      opacity: markersVisible ? (selectedId && !isAnySelected ? 0.5 : 1) : 0,
                      filter: isAnySelected ? 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))' : 'none',
                    }}
                    onClick={() => {
                      // 단일 법인이면 바로 클릭, 여러 개면 첫 번째 선택
                      if (group.subsidiaries.length === 1) {
                        onSubsidiaryClick(group.subsidiaries[0].id);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (hasMultiple) {
                        e.stopPropagation();
                        handleMarkerMouseEnter(e, groupKey);
                      }
                    }}
                    onMouseLeave={handleMarkerMouseLeave}
                  />

                  {/* Entity 수 표시 (1개 초과일 때) */}
                  {hasMultiple && (
                    <text
                      textAnchor="middle"
                      y={3}
                      className="text-xs font-bold fill-white pointer-events-none"
                      style={{ fontSize: '9px' }}
                    >
                      {group.subsidiaries.length}
                    </text>
                  )}

                  {/* Hover tooltip */}
                  <title>
                    {hasMultiple
                      ? `${group.country} (${group.subsidiaries.length} entities)`
                      : group.subsidiaries[0].name}
                  </title>
                </g>
              </Marker>
            );
          })}

          {/* 2단계: 모든 텍스트 라벨 나중에 렌더링 (다른 마커 위에 표시) - 다크 테마 */}
          {countryGroups.map((group, groupIndex) => {
            const hasMultiple = group.subsidiaries.length > 1;
            const isAnySelected = group.subsidiaries.some((sub) => sub.id === selectedId);
            const groupKey = `label-${groupIndex}`;
            const offset = labelOffsets[groupIndex] || { x: 0, y: 0, yOffset: 0 };
            
            // 레이블 텍스트 결정 (겹침 방지를 위해 짧게)
            let labelText: string;
            if (hasMultiple) {
              labelText = group.country;
            } else {
              const displayName = group.subsidiaries[0].name.replace('InBody ', '');
              // "Asia Singapore" 같은 경우 "Singapore"만 표시
              if (displayName.includes(' ')) {
                const parts = displayName.split(' ');
                labelText = parts[parts.length - 1]; // 마지막 단어만
              } else {
                labelText = displayName;
              }
            }

            // 기본 y 위치 계산
            const baseY = isAnySelected ? -22 : hasMultiple ? -20 : -20;
            // offset 적용 (위아래로 분리)
            const finalY = baseY + offset.yOffset;

            return (
              <Marker 
                key={groupKey} 
                coordinates={[
                  group.longitude + offset.x, 
                  group.latitude + offset.y
                ]}
              >
                <text
                  textAnchor="middle"
                  y={finalY}
                  className={cn(
                    'text-xs font-medium fill-gray-200 pointer-events-none transition-all duration-300',
                    markersVisible ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{ 
                    fontSize: '9px',
                    stroke: '#0f0f23',
                    strokeWidth: '0.4px',
                    paintOrder: 'stroke fill',
                    transitionDelay: `${(groupIndex + countryGroups.length) * 50}ms`,
                  }}
                >
                  {labelText}
                </text>
              </Marker>
            );
          })}
        </ComposableMap>
      </div>

      {/* ✅ 수정: 확대/축소 버튼 - z-index 증가 및 배경 명확히 */}
      <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          className="bg-slate-800/90 backdrop-blur-sm shadow-xl hover:bg-slate-700 border-slate-600"
          onClick={handleZoomIn}
        >
          <Plus className="h-5 w-5 text-white" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="bg-slate-800/90 backdrop-blur-sm shadow-xl hover:bg-slate-700 border-slate-600"
          onClick={handleZoomOut}
        >
          <Minus className="h-5 w-5 text-white" />
        </Button>
      </div>


      {/* Entity 리스트 오버레이 (여러 법인이 있을 때) - 다크 테마 */}
      {hoveredGroup && hoverPosition && (
        <div
          data-entity-overlay
          className="absolute z-[100] bg-[#1a1a2e] rounded-lg shadow-lg border border-[#2d2d44] p-2 min-w-[200px]"
          style={{
            left: `${hoverPosition.x + 20}px`,
            top: `${hoverPosition.y - 10}px`,
            pointerEvents: 'auto',
          }}
          onMouseEnter={(e) => {
            // 오버레이 위에 마우스가 있을 때는 유지
            e.stopPropagation();
          }}
          onMouseLeave={() => {
            setHoveredGroup(null);
            setHoverPosition(null);
          }}
        >
          {(() => {
            const group = countryGroups.find(
              (_, index) => `group-${index}` === hoveredGroup
            );
            if (!group || group.subsidiaries.length <= 1) return null;

            return (
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs font-semibold text-gray-300 border-b border-[#2d2d44] mb-1">
                  {group.country} ({group.subsidiaries.length})
                </div>
                {group.subsidiaries.map((sub) => {
                  const isSelected = selectedId === sub.id;
                  const displayName = sub.name.replace('InBody ', '');

                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSubsidiaryClick(sub.id);
                        setHoveredGroup(null);
                        setHoverPosition(null);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-blue-600 text-white font-medium'
                          : 'hover:bg-[#252540] text-gray-300'
                      )}
                    >
                      {displayName}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* 범례 - 다크 테마 */}
      <div className="absolute bottom-6 left-6 bg-[#1a1a2e] p-3 rounded-lg shadow-lg border border-[#2d2d44] z-40">
        <h3 className="text-xs font-semibold text-gray-300 mb-2">Regions</h3>
        <div className="space-y-1">
          {Object.entries(REGION_COLORS).map(([region, color]) => (
            <div key={region} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-400">{region}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

