// ========================================
// Supabase 카드뉴스 데이터 삽입 스크립트
// ========================================

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ESM 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// JSON 파일 읽기
const ifrsDataPath = path.join(__dirname, 'ifrs_card_news_data.json')
const dutchDataPath = path.join(__dirname, 'dutch_gaap_card_news_data.json')
const ifrsData = JSON.parse(fs.readFileSync(ifrsDataPath, 'utf-8'))
const dutchData = JSON.parse(fs.readFileSync(dutchDataPath, 'utf-8'))

// 환경 변수 로드 (.env.local 파일에서)
import dotenv from 'dotenv'

// 현재 디렉토리 기준으로 .env.local 파일 경로 설정
const envPath = path.join(process.cwd(), '.env.local')
const result = dotenv.config({ path: envPath })

// 디버깅: 로드된 환경 변수 확인
if (result.error) {
  console.warn('⚠️  .env.local 파일 로드 오류:', result.error)
}

// Supabase 클라이언트 초기화
// .env.local 파일에서 따옴표 제거 및 trim 처리
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^["']|["']$/g, '').trim()
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^["']|["']$/g, '').trim()

if (!supabaseUrl) {
  console.error('환경 변수 확인:', {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'exists' : 'missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'missing',
    envPath
  })
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required. Please set it in .env.local')
}
if (!supabaseServiceKey) {
  console.error('환경 변수 확인:', {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'exists' : 'missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'missing',
    envPath
  })
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required. Please set it in .env.local')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface Standard {
  standard_code: string
  standard_name: string
  country: string
  description: string
}

interface Category {
  category_name: string
  category_name_en: string
  display_order: number
  icon: string
  color: string
}

interface Card {
  category: string
  card_number: number
  title: string
  subtitle?: string
  content: string
  key_points?: string[]
  examples?: any
  visual_data?: any
  tags?: string[]
  is_important?: boolean
}

interface PracticalTip {
  card_title: string
  tips: {
    tip_content: string
    tip_type: 'warning' | 'info' | 'best_practice'
  }[]
}

interface CardNewsData {
  standard: Standard
  categories: Category[]
  cards: Card[]
  practical_tips?: PracticalTip[]
}

// ========================================
// 메인 삽입 함수
// ========================================

async function insertCardNewsData() {
  try {
    console.log('🚀 Starting data insertion...')
    
    // 1. IFRS 데이터 삽입
    console.log('\n📊 Inserting IFRS data...')
    await insertStandardData(ifrsData as CardNewsData)
    
    // 2. Dutch GAAP 데이터 삽입
    console.log('\n📋 Inserting Dutch GAAP data...')
    await insertStandardData(dutchData as CardNewsData)
    
    console.log('\n✅ All data inserted successfully!')
  } catch (error) {
    console.error('❌ Error inserting data:', error)
    throw error
  }
}

// ========================================
// 회계기준별 데이터 삽입
// ========================================

async function insertStandardData(data: CardNewsData) {
  // 1. Standard 삽입
  console.log(`  → Inserting standard: ${data.standard.standard_name}`)
  let standardData: { id: string } | null = null
  
  const { data: insertedStandard, error: standardError } = await supabase
    .from('accounting_standards')
    .insert([data.standard])
    .select()
    .single()
  
  if (standardError) {
    // 이미 존재하는 경우 가져오기
    const { data: existingStandard, error: fetchError } = await supabase
      .from('accounting_standards')
      .select('*')
      .eq('standard_code', data.standard.standard_code)
      .single()
    
    if (fetchError || !existingStandard) throw standardError
    console.log(`  ℹ️  Standard already exists, using existing ID`)
    standardData = { id: existingStandard.id }
  } else {
    standardData = insertedStandard
  }
  
  if (!standardData) {
    throw new Error('Failed to get or create standard')
  }
  
  const standardId = standardData.id
  console.log(`  ✓ Standard inserted/found: ${standardId}`)
  
  // 2. Categories 삽입
  console.log(`  → Inserting ${data.categories.length} categories...`)
  const categoryMap = new Map<string, string>() // category_name -> category_id
  
  for (const category of data.categories) {
    const { data: categoryData, error: categoryError } = await supabase
      .from('card_categories')
      .insert([{
        standard_id: standardId,
        ...category
      }])
      .select()
      .single()
    
    if (categoryError) {
      // 이미 존재하는 경우 가져오기
      const { data: existingCategory } = await supabase
        .from('card_categories')
        .select('*')
        .eq('standard_id', standardId)
        .eq('category_name', category.category_name)
        .single()
      
      if (!existingCategory) throw categoryError
      categoryMap.set(category.category_name, existingCategory.id)
    } else {
      categoryMap.set(category.category_name, categoryData!.id)
    }
  }
  console.log(`  ✓ ${categoryMap.size} categories inserted/found`)
  
  // 3. Cards 삽입
  console.log(`  → Inserting ${data.cards.length} cards...`)
  let insertedCount = 0
  
  for (const card of data.cards) {
    const categoryId = categoryMap.get(card.category)
    if (!categoryId) {
      console.warn(`  ⚠️  Category not found for card: ${card.title}`)
      continue
    }
    
    const { error: cardError } = await supabase
      .from('card_news')
      .insert([{
        category_id: categoryId,
        card_number: card.card_number,
        title: card.title,
        subtitle: card.subtitle || null,
        content: card.content,
        key_points: card.key_points || null,
        examples: card.examples || null,
        visual_data: card.visual_data || null,
        tags: card.tags || [],
        is_important: card.is_important || false
      }])
    
    if (cardError) {
      console.warn(`  ⚠️  Error inserting card "${card.title}": ${cardError.message}`)
    } else {
      insertedCount++
    }
  }
  console.log(`  ✓ ${insertedCount}/${data.cards.length} cards inserted`)
  
  // 4. Practical Tips 삽입 (선택사항)
  if (data.practical_tips && data.practical_tips.length > 0) {
    console.log(`  → Inserting practical tips...`)
    let tipCount = 0
    
    for (const tipGroup of data.practical_tips) {
      // 카드 ID 찾기
      const { data: cardData } = await supabase
        .from('card_news')
        .select('id')
        .eq('title', tipGroup.card_title)
        .single()
      
      if (!cardData) {
        console.warn(`  ⚠️  Card not found for tips: ${tipGroup.card_title}`)
        continue
      }
      
      // Tips 삽입
      for (const [index, tip] of tipGroup.tips.entries()) {
        const { error: tipError } = await supabase
          .from('practical_tips')
          .insert([{
            card_id: cardData.id,
            tip_content: tip.tip_content,
            tip_type: tip.tip_type,
            display_order: index + 1
          }])
        
        if (!tipError) tipCount++
      }
    }
    console.log(`  ✓ ${tipCount} practical tips inserted`)
  }
}

// ========================================
// 데이터 검증 함수
// ========================================

async function verifyData() {
  console.log('\n🔍 Verifying inserted data...')
  
  // 1. Standards 확인
  const { data: standards, error: standardsError } = await supabase
    .from('accounting_standards')
    .select('*')
  
  if (standardsError) throw standardsError
  console.log(`  ✓ Standards count: ${standards.length}`)
  
  // 2. Categories 확인
  const { data: categories, error: categoriesError } = await supabase
    .from('card_categories')
    .select('*')
  
  if (categoriesError) throw categoriesError
  console.log(`  ✓ Categories count: ${categories.length}`)
  
  // 3. Cards 확인
  const { data: cards, error: cardsError } = await supabase
    .from('card_news')
    .select('*')
  
  if (cardsError) throw cardsError
  console.log(`  ✓ Cards count: ${cards.length}`)
  
  // 4. Important cards 확인
  const { data: importantCards } = await supabase
    .from('card_news')
    .select('*')
    .eq('is_important', true)
  
  console.log(`  ✓ Important cards count: ${importantCards?.length || 0}`)
  
  // 5. View 확인
  const { data: fullCards, error: viewError } = await supabase
    .from('card_news_full')
    .select('*')
  
  if (!viewError) {
    console.log(`  ✓ Full view records: ${fullCards.length}`)
  }
}

// ========================================
// 데이터 삭제 함수 (재삽입용)
// ========================================

async function clearAllData() {
  console.log('🗑️  Clearing all existing data...')
  
  // 참조 무결성 순서대로 삭제
  await supabase.from('practical_tips').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('card_references').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('card_news').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('card_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('accounting_standards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  console.log('  ✓ All data cleared')
}

// ========================================
// 실행
// ========================================

async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--clear')) {
    await clearAllData()
  }
  
  await insertCardNewsData()
  await verifyData()
  
  console.log('\n🎉 Done!')
}

// 스크립트로 실행 시 (ESM 모듈)
// import.meta.url을 사용하여 직접 실행 여부 확인
const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || 
                     process.argv[1]?.endsWith('insert_card_news_script.ts')

if (isMainModule || !import.meta.url.includes('node_modules')) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export { insertCardNewsData, verifyData, clearAllData }
