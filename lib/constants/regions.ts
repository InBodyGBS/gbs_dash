/**
 * 지역별 색상 상수 정의
 * 세계지도 마커 색상 구분에 사용
 */

export const REGIONS = {
  AMERICAS: 'Americas',
  EUROPE: 'Europe',
  ASIA_PACIFIC: 'Asia-Pacific',
} as const;

/**
 * 지역별 색상 매핑
 * Tailwind CSS 색상 사용
 */
export const REGION_COLORS: Record<string, string> = {
  'Americas': '#3B82F6',      // blue-500
  'Europe': '#10B981',        // green-500
  'Asia-Pacific': '#F59E0B',  // amber-500
} as const;

/**
 * 지역 타입
 */
export type RegionType = keyof typeof REGION_COLORS;

