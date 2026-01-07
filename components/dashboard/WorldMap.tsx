'use client';

/**
 * 세계지도 컴포넌트
 * react-simple-maps를 사용하여 법인 위치를 마커로 표시
 */

import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Subsidiary } from '@/lib/supabase/types';
import { REGION_COLORS } from '@/lib/constants/regions';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface WorldMapProps {
  subsidiaries: Subsidiary[];
  selectedId?: string | null;
  onSubsidiaryClick: (id: string) => void;
}

/**
 * 세계지도 기반 법인 위치 시각화
 * 지역별 색상 구분 및 클릭 인터랙션 제공
 */
export const WorldMap = ({ subsidiaries, selectedId, onSubsidiaryClick }: WorldMapProps) => {
  return (
    <div className="w-full h-full bg-slate-100 rounded-lg">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 140,
          center: [30, 20],
        }}
        className="w-full h-full"
      >
        {/* 세계지도 배경 */}
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#f9fafb"
                stroke="#d1d5db"
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover: { outline: 'none', fill: '#f3f4f6' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>

        {/* 법인 마커 */}
        {subsidiaries.map((sub) => {
          const isSelected = selectedId === sub.id;
          const markerColor = REGION_COLORS[sub.region] || '#3B82F6';
          // "InBody " 제거한 법인명
          const displayName = sub.name.replace('InBody ', '');

          return (
            <Marker
              key={sub.id}
              coordinates={[sub.longitude, sub.latitude]}
            >
              <g onClick={() => onSubsidiaryClick(sub.id)}>
                {/* 원형 마커 */}
                <circle
                  r={isSelected ? 12 : 10}
                  fill={markerColor}
                  stroke={isSelected ? '#1f2937' : 'transparent'}
                  strokeWidth={3}
                  className="cursor-pointer transition-all duration-200 hover:scale-110"
                  opacity={selectedId && !isSelected ? 0.5 : 1}
                  style={{
                    filter: isSelected ? 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))' : 'none',
                  }}
                />

                {/* 법인명 라벨 (항상 표시) */}
                <g>
                  {/* 배경 */}
                  <rect
                    x={-30}
                    y={-28}
                    width={60}
                    height={16}
                    fill="white"
                    opacity={0.8}
                    rx={3}
                    className="pointer-events-none"
                  />
                  {/* 텍스트 */}
                  <text
                    textAnchor="middle"
                    y={-18}
                    className="text-xs font-medium fill-gray-700 pointer-events-none"
                    style={{ fontSize: '11px' }}
                  >
                    {displayName}
                  </text>
                </g>

                {/* Hover tooltip (브라우저 기본 tooltip) */}
                <title>{sub.name}</title>
              </g>
            </Marker>
          );
        })}
      </ComposableMap>

      {/* 범례 */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-xs font-semibold text-gray-700 mb-2">Regions</h3>
        <div className="space-y-1">
          {Object.entries(REGION_COLORS).map(([region, color]) => (
            <div key={region} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-600">{region}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

