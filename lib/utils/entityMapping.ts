/**
 * Entity 이름과 Subsidiaries 매핑 유틸리티
 */

import { supabase } from '@/lib/supabase/client';
import type { Subsidiary } from '@/lib/supabase/types';

/**
 * Entity 이름을 Subsidiary ID로 매핑
 * 노트북 파일의 ENTITY_NAME_MAPPING 참고
 */
const ENTITY_TO_CODE_MAPPING: Record<string, string> = {
  'HQ': 'HQ',
  'USA': 'USA',
  'Japan': 'JPN',
  'China': 'CHN',
  'Europe': 'EUR',
  'Asia': 'ASIA',
  'India': 'IND',
  'Mexico': 'MEX',
  'Oceania': 'OCE',
  'BWA': 'BWA',
  'Vietnam': 'VNM',
  'Turkey': 'TUR',
  'KOROT': 'KOROT',
  '헬스케어': 'HEALTHCARE',
  '삼한정공': 'SAMHAN',
  'KOCP': 'KOCP',
  'Netherlands': 'NLD',
  'DE': 'DEU',
  'UK': 'GBR',
  'Singapore': 'SGP',
  '연결조정': null as any, // subsidiaries에 없음
  '합계': null as any, // 합계는 subsidiaries에 없음
};

/**
 * Entity 이름으로 Subsidiary ID 찾기
 */
export async function findSubsidiaryIdByEntity(
  entityName: string
): Promise<string | null> {
  try {
    // 매핑에서 code 찾기
    const code = ENTITY_TO_CODE_MAPPING[entityName];
    if (!code) {
      // 매핑에 없으면 entity 이름으로 직접 검색
      const { data, error } = await supabase
        .from('subsidiaries')
        .select('id')
        .or(`code.eq.${entityName},name.eq.${entityName}`)
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return data.id;
    }

    // code로 검색
    const { data, error } = await supabase
      .from('subsidiaries')
      .select('id')
      .eq('code', code)
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Find Subsidiary ID Error:', error);
    return null;
  }
}

/**
 * 모든 Entity → Subsidiary ID 매핑 가져오기
 */
export async function getEntityToSubsidiaryMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();

  try {
    const { data: subsidiaries, error } = await supabase
      .from('subsidiaries')
      .select('id, code, name');

    if (error || !subsidiaries) {
      return mapping;
    }

    // Entity 이름 → Subsidiary ID 매핑 생성
    Object.entries(ENTITY_TO_CODE_MAPPING).forEach(([entity, code]) => {
      if (code) {
        const subsidiary = subsidiaries.find((s) => s.code === code);
        if (subsidiary) {
          mapping.set(entity, subsidiary.id);
        }
      }
    });

    // 추가 매핑: name으로도 매핑
    subsidiaries.forEach((subsidiary) => {
      if (!mapping.has(subsidiary.name)) {
        mapping.set(subsidiary.name, subsidiary.id);
      }
      if (!mapping.has(subsidiary.code)) {
        mapping.set(subsidiary.code, subsidiary.id);
      }
    });

    return mapping;
  } catch (error) {
    console.error('Get Entity Mapping Error:', error);
    return mapping;
  }
}

/**
 * Entity 이름 정규화 (노트북 파일의 rename_entity 함수 참고)
 */
export function normalizeEntityName(entityName: string): string {
  const ENTITY_NAME_MAPPING: Record<string, string> = {
    'BIOSPACE LATIN AMERICA S DE RL DE CV(*)': 'Mexico',
    'BWA': 'BWA',
    'Biospace Co.,Ltd.': 'China',
    'Biospace Inc. DBA INBODY': 'USA',
    'InBody India Pvt. Ltd': 'India',
    'InBody Japan Inc.': 'Japan',
    'InBody Oceania ': 'Oceania',
    '㈜코르트': 'KOROT',
    'Inbody Europe B.V.': 'Europe',
    '㈜인바디헬스케어': '헬스케어',
    '(주)삼한정공': '삼한정공',
    'INBODY TURKEY MEDİKAL TİCARET LİMİTED ŞİRKETİ': 'Turkey',
    'INBODY ASIA SDN. BHD.': 'Asia',
    '주식회사 인바디': 'HQ',
    '케이오씨피 프로젝트 제2호 벤처투자조합': 'KOCP',
    'InBody Vietnam': 'Vietnam',
    'InBody Netherlands': 'Netherlands',
    'InBody DE': 'DE',
    'InBody UK': 'UK',
    'InBody Singapore': 'Singapore',
    'ADJ': '연결조정',
  };

  return ENTITY_NAME_MAPPING[entityName] || entityName;
}
