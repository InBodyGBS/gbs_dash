/**
 * 성사율 계산 유틸리티
 */

import type { ScheduleItem } from '@/lib/types/quarterly-closing';

/**
 * 전체 성사율 계산
 * @param items - 스케줄 항목 배열
 * @returns 성사율 (0-100, 소수점 1자리)
 */
export const calculateAchievementRate = (items: ScheduleItem[]): number => {
  const total = items.length;
  if (total === 0) return 0;

  const confirmed = items.filter((item) => item.status === 'confirmed').length;
  return Math.round((confirmed / total) * 100 * 10) / 10;
};

/**
 * 법인별 성사율 계산
 * @param items - 스케줄 항목 배열
 * @param subsidiaryId - 법인 ID
 * @returns 성사율 (0-100, 소수점 1자리)
 */
export const calculateBySubsidiary = (
  items: ScheduleItem[],
  subsidiaryId: string
): number => {
  const subsidiaryItems = items.filter((item) => item.subsidiary_id === subsidiaryId);
  return calculateAchievementRate(subsidiaryItems);
};

/**
 * 지역별 성사율 계산
 * @param items - 스케줄 항목 배열
 * @param subsidiaries - 법인 배열
 * @param region - 지역명
 * @returns 성사율 (0-100, 소수점 1자리)
 */
export const calculateByRegion = (
  items: ScheduleItem[],
  subsidiaries: Array<{ id: string; region: string }>,
  region: string
): number => {
  const regionSubsidiaryIds = subsidiaries
    .filter((sub) => sub.region === region)
    .map((sub) => sub.id);

  const regionItems = items.filter((item) =>
    regionSubsidiaryIds.includes(item.subsidiary_id)
  );

  return calculateAchievementRate(regionItems);
};

/**
 * 카테고리별 성사율 계산
 * @param items - 스케줄 항목 배열
 * @param category - 카테고리 ID
 * @returns 성사율 (0-100, 소수점 1자리)
 */
export const calculateByCategory = (
  items: ScheduleItem[],
  category: string
): number => {
  const categoryItems = items.filter((item) => item.category === category);
  return calculateAchievementRate(categoryItems);
};

