/**
 * 포맷팅 유틸리티 함수
 * 숫자, 날짜, 통화 등의 포맷팅을 담당
 */

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 원화를 억원 단위로 포맷팅
 * @param amount - 원화 금액 (원 단위)
 * @returns 억원 단위 문자열 (예: "500억원")
 * @example formatKRW(50000000000) // "500억원"
 */
export const formatKRW = (amount: number): string => {
  const billion = amount / 100000000;
  return `${billion.toLocaleString('ko-KR')}억원`;
};

/**
 * 영업이익률을 퍼센트로 포맷팅
 * @param margin - 영업이익률 (%)
 * @returns 소수점 1자리 퍼센트 문자열 (예: "10.9%")
 * @example formatMargin(10.87) // "10.9%"
 */
export const formatMargin = (margin: number): string => {
  return `${margin.toFixed(1)}%`;
};

/**
 * 연도와 분기를 "YYYY QN" 형식으로 포맷팅
 * @param year - 연도
 * @param quarter - 분기 (1-4)
 * @returns "YYYY QN" 형식 문자열 (예: "2024 Q4")
 * @example formatPeriod(2024, 4) // "2024 Q4"
 */
export const formatPeriod = (year: number, quarter: number): string => {
  return `${year} Q${quarter}`;
};

/**
 * 날짜를 "YYYY년 MM월 DD일" 형식으로 포맷팅
 * @param date - Date 객체 또는 날짜 문자열
 * @returns 한국어 날짜 문자열 (예: "2024년 01월 07일")
 */
export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy년 MM월 dd일', { locale: ko });
};

/**
 * 날짜와 시간을 "YYYY년 MM월 DD일 HH:mm" 형식으로 포맷팅
 * @param date - Date 객체 또는 날짜 문자열
 * @returns 한국어 날짜/시간 문자열 (예: "2024년 01월 07일 14:30")
 */
export const formatDateTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
};

/**
 * 영업이익률 계산
 * @param profit - 영업이익 (원 단위)
 * @param revenue - 매출액 (원 단위)
 * @returns 영업이익률 (%)
 */
export const calculateMargin = (profit: number, revenue: number): number => {
  if (revenue === 0) return 0;
  return (profit / revenue) * 100;
};

/**
 * 목표 달성률 계산
 * @param actual - 실제 값
 * @param target - 목표 값
 * @returns 달성률 (%)
 */
export const calculateAchievementRate = (actual: number, target: number): number => {
  if (target === 0) return 0;
  return (actual / target) * 100;
};

/**
 * 큰 숫자를 단위와 함께 포맷팅 (K, M, B)
 * @param num - 숫자
 * @returns 포맷된 문자열 (예: "1.5M")
 */
export const formatLargeNumber = (num: number): string => {
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`;
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

