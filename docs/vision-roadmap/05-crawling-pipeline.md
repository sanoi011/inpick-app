# 건자재 크롤링 자동화 파이프라인

> Stage 1 지원 인프라
> 목표: 한국 건자재 시장 주요 제품 1,000개 데이터 수집 자동화

---

## 1. 아키텍처

```
[Claude Code Agent] ─── 오케스트레이터
    │
    ├─ 사이트 분석 → 크롤링 스크립트 자동 생성
    ├─ 스크립트 실행 → 원시 데이터 수집
    ├─ Gemini Vision → 구조화 파싱
    └─ 검증 → Supabase 저장
    
[기술 스택]
    │
    ├─ Playwright (크롤링)
    ├─ Gemini 2.5 Pro Vision (이미지 분석 + 데이터 정제)
    ├─ Sharp (이미지 전처리)
    ├─ Supabase (DB + Storage)
    └─ Node.js 스크립트 (TypeScript)
```

---

## 2. 크롤링 대상

### 2-1. 사이트별 전략

| 사이트 | URL | 대상 제품 | 수집 방법 | 예상 수량 |
|--------|-----|----------|----------|----------|
| **동화자연마루** | dwflooring.co.kr | 마루 전 제품 | 정적 HTML 파싱 | 80개 |
| **LX하우시스 Z:IN** | z-in.com | 바닥재/벽지/창호 | Playwright SSR | 150개 |
| **한샘몰** | hanssem.com | 주방/가구/바닥 | Playwright + API | 200개 |
| **TOTO Korea** | kr.toto.com | 위생도기/수전 | 정적 HTML | 60개 |
| **대림바스** | daelim-qualis.co.kr | 욕실 세트 | 정적 HTML | 40개 |
| **이눅스타일** | inuxtile.com | 타일 전 제품 | Playwright | 100개 |
| **영림도어** | younglimdoor.com | 문/창호 | 정적 HTML | 50개 |
| **신한벽지** | shinhwa-wallpaper.com | 벽지 | 카탈로그 PDF | 100개 |
| **네이버 쇼핑** | shopping.naver.com | 가격 비교 | 네이버 API | 보조 |
| **오늘의집** | ohou.se | 시공 사진 (YOLO 학습용) | API + 크롤링 | 5,000장 |

### 2-2. 우선순위

```
1순위 (1주차): 동화자연마루 + TOTO + 이눅스타일
  → 정적 사이트, 크롤링 쉬움, 핵심 카테고리 (바닥/도기/타일)

2순위 (2주차): LX하우시스 + 한샘 + 대림바스
  → SPA/SSR 사이트, Playwright 필요

3순위 (3주차): 영림도어 + 신한벽지 + 네이버 쇼핑 가격
  → 보조 카테고리 + 가격 크로스체크

학습 데이터: 오늘의집 시공사례 (상시 수집)
```

---

## 3. 크롤러 설계

### 3-1. 공통 설정 파일

```typescript
// scripts/crawlers/crawl-config.ts

export interface CrawlTarget {
  id: string;
  name: string;
  baseUrl: string;
  categories: {
    path: string;           // 카테고리 페이지 경로
    categoryCode: string;   // FLOORING, BATH_TILE 등
    subCategory?: string;   // laminate, porcelain 등
  }[];
  selectors: {
    productList: string;    // 제품 목록 컨테이너
    productCard: string;    // 개별 제품 카드
    productLink: string;    // 상세 페이지 링크
    productName: string;    // 제품명
    productPrice: string;   // 가격
    productImage: string;   // 대표 이미지
    productSpec: string;    // 규격
    pagination?: string;    // 페이지네이션 (다음 페이지)
  };
  detailSelectors: {
    name: string;
    price: string;
    spec: string;
    images: string;         // 상세 이미지들
    description: string;
  };
  rateLimit: number;        // 요청 간격 (ms)
  needsPlaywright: boolean; // SPA/SSR 여부
}

export const TARGETS: CrawlTarget[] = [
  {
    id: "dongwha",
    name: "동화자연마루",
    baseUrl: "https://www.dwflooring.co.kr",
    categories: [
      { path: "/product/list?category=laminate", categoryCode: "FLOORING", subCategory: "laminate" },
      { path: "/product/list?category=engineered", categoryCode: "FLOORING", subCategory: "engineered_wood" },
    ],
    selectors: {
      productList: ".product-list",
      productCard: ".product-item",
      productLink: "a",
      productName: ".product-name",
      productPrice: ".product-price",
      productImage: "img",
      productSpec: ".product-spec",
      pagination: ".pagination .next",
    },
    detailSelectors: {
      name: "h1.product-title",
      price: ".price-info .price",
      spec: ".spec-table",
      images: ".product-gallery img",
      description: ".product-description",
    },
    rateLimit: 2000,
    needsPlaywright: false,
  },
  // ... 다른 사이트들
];
```

### 3-2. 크롤러 본체

```typescript
// scripts/crawlers/crawler-engine.ts

import { chromium, type Page } from "playwright";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import type { CrawlTarget } from "./crawl-config";

interface RawProduct {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  name: string;
  price: string | null;
  spec: string | null;
  imageUrls: string[];
  detailUrl: string;
  categoryCode: string;
  subCategory: string | null;
  rawHtml?: string;
}

export async function crawlTarget(target: CrawlTarget): Promise<RawProduct[]> {
  const products: RawProduct[] = [];
  const outputDir = `raw-data/${target.id}`;
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(`${outputDir}/images`, { recursive: true });

  let browser;
  let page: Page | null = null;

  if (target.needsPlaywright) {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    // 봇 감지 우회
    await page.setExtraHTTPHeaders({
      "Accept-Language": "ko-KR,ko;q=0.9",
    });
  }

  for (const category of target.categories) {
    const url = `${target.baseUrl}${category.path}`;
    console.log(`[${target.id}] Crawling: ${url}`);

    let html: string;

    if (target.needsPlaywright && page) {
      await page.goto(url, { waitUntil: "networkidle" });
      html = await page.content();
    } else {
      const res = await fetch(url);
      html = await res.text();
    }

    const $ = cheerio.load(html);
    const cards = $(target.selectors.productCard);

    console.log(`[${target.id}] Found ${cards.length} products`);

    for (let i = 0; i < cards.length; i++) {
      const card = $(cards[i]);
      const name = card.find(target.selectors.productName).text().trim();
      const price = card.find(target.selectors.productPrice).text().trim() || null;
      const imgSrc = card.find(target.selectors.productImage).attr("src") || "";
      const detailHref = card.find(target.selectors.productLink).attr("href") || "";

      const detailUrl = detailHref.startsWith("http")
        ? detailHref
        : `${target.baseUrl}${detailHref}`;

      const imageUrl = imgSrc.startsWith("http")
        ? imgSrc
        : `${target.baseUrl}${imgSrc}`;

      products.push({
        sourceId: target.id,
        sourceName: target.name,
        sourceUrl: detailUrl,
        name,
        price,
        spec: null,
        imageUrls: [imageUrl],
        detailUrl,
        categoryCode: category.categoryCode,
        subCategory: category.subCategory || null,
      });

      // 이미지 다운로드
      try {
        const imgRes = await fetch(imageUrl);
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        const imgPath = `${outputDir}/images/${target.id}-${i}.jpg`;
        await fs.writeFile(imgPath, imgBuffer);
      } catch (e) {
        console.warn(`[${target.id}] Image download failed: ${imageUrl}`);
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, target.rateLimit));
    }
  }

  // 결과 저장
  await fs.writeFile(
    `${outputDir}/products.json`,
    JSON.stringify(products, null, 2)
  );

  if (browser) await browser.close();

  console.log(`[${target.id}] Total: ${products.length} products`);
  return products;
}
```

### 3-3. Gemini 구조화 파싱

```typescript
// scripts/parsers/parse-with-gemini.ts

import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import path from "path";

const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

interface ParsedProduct {
  brand: string;
  productName: string;
  modelNumber: string | null;
  specification: string | null;
  retailPrice: number | null;
  laborPrice: number | null;
  unit: string;
  categoryCode: string;
  subCategory: string | null;
  priceGrade: "economy" | "standard" | "premium";
  dominantColors: string[];
  patternType: string | null;
  surfaceFinish: string | null;
  materialTexture: string | null;
  colorName: string | null;
  thumbnailPath: string;
}

const PARSE_PROMPT = `이 건자재 제품 정보와 이미지를 분석해서 다음 JSON으로 구조화해주세요.

입력 데이터:
- 제품명: {name}
- 가격 텍스트: {price}
- 소스: {source}
- 카테고리: {category}

이미지도 함께 분석하여 색상과 재질을 판단하세요.

JSON 형식:
{
  "brand": "브랜드명 (제조사)",
  "productName": "제품명 (브랜드 제외)",
  "modelNumber": "모델번호 (있으면)",
  "specification": "규격 (예: 1200x190x8mm)",
  "retailPrice": 65000,  // 소비자가 (원/단위), 없으면 시장가 추정
  "laborPrice": 23000,   // 시공비 (원/단위), 카테고리별 표준 적용
  "unit": "m²",          // m² | EA | SET | LM
  "priceGrade": "standard",  // economy | standard | premium
  "dominantColors": ["#8B6F47", "#A0845C"],  // 이미지에서 추출
  "patternType": "straight",  // straight|herringbone|chevron|mosaic|subway|plain 등
  "surfaceFinish": "matte",   // matte|semi_gloss|gloss|textured
  "materialTexture": "wood_grain",  // wood_grain|stone|ceramic|marble|concrete|fabric
  "colorName": "내추럴 오크"   // 제조사 공식 색상명
}`;

export async function parseProducts(sourceDir: string): Promise<ParsedProduct[]> {
  const rawData = JSON.parse(
    await fs.readFile(`${sourceDir}/products.json`, "utf-8")
  );

  const parsed: ParsedProduct[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const raw = rawData[i];
    const imgPath = `${sourceDir}/images/${raw.sourceId}-${i}.jpg`;

    let imagePart = null;
    try {
      const imgBuffer = await fs.readFile(imgPath);
      imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: imgBuffer.toString("base64"),
        },
      };
    } catch {
      // 이미지 없으면 텍스트만으로 파싱
    }

    const prompt = PARSE_PROMPT
      .replace("{name}", raw.name)
      .replace("{price}", raw.price || "가격 정보 없음")
      .replace("{source}", raw.sourceName)
      .replace("{category}", raw.categoryCode);

    const parts = imagePart
      ? [imagePart, { text: prompt }]
      : [{ text: prompt }];

    try {
      const response = await client.models.generateContent({
        model: "gemini-2.5-pro-preview",
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const result = JSON.parse(text);

      parsed.push({
        ...result,
        categoryCode: raw.categoryCode,
        subCategory: raw.subCategory,
        thumbnailPath: imgPath,
      });

      console.log(`[parse] ${i + 1}/${rawData.length}: ${result.brand} ${result.productName}`);
    } catch (e) {
      console.error(`[parse] Failed: ${raw.name}`, e);
    }

    // Rate limit (Gemini)
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 결과 저장
  const outputDir = sourceDir.replace("raw-data", "parsed-data");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    `${outputDir}/products.json`,
    JSON.stringify(parsed, null, 2)
  );

  return parsed;
}
```

### 3-4. Supabase 저장

```typescript
// scripts/importers/import-to-supabase.ts

import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // 서비스 키 (RLS 우회)
);

export async function importProducts(parsedDir: string) {
  const products = JSON.parse(
    await fs.readFile(`${parsedDir}/products.json`, "utf-8")
  );

  let imported = 0;
  let skipped = 0;

  for (const p of products) {
    // 필수 필드 검증
    if (!p.brand || !p.productName || !p.retailPrice) {
      console.warn(`[skip] 필수 필드 누락: ${p.productName}`);
      skipped++;
      continue;
    }

    // 중복 검사 (model_number 또는 brand+product_name)
    const { data: existing } = await supabase
      .from("material_products")
      .select("id")
      .eq("brand", p.brand)
      .eq("product_name", p.productName)
      .maybeSingle();

    if (existing) {
      console.log(`[skip] 중복: ${p.brand} ${p.productName}`);
      skipped++;
      continue;
    }

    // 이미지 업로드
    let thumbnailUrl = null;
    if (p.thumbnailPath) {
      try {
        const imgBuffer = await fs.readFile(p.thumbnailPath);
        const fileName = `materials/${p.categoryCode}/${Date.now()}-${path.basename(p.thumbnailPath)}`;
        const { data } = await supabase.storage
          .from("material-images")
          .upload(fileName, imgBuffer, { contentType: "image/jpeg" });
        if (data) {
          const { data: urlData } = supabase.storage
            .from("material-images")
            .getPublicUrl(fileName);
          thumbnailUrl = urlData.publicUrl;
        }
      } catch (e) {
        console.warn(`[img] Upload failed: ${p.thumbnailPath}`);
      }
    }

    // DB 저장
    const { error } = await supabase.from("material_products").insert({
      category_code: p.categoryCode,
      sub_category: p.subCategory,
      brand: p.brand,
      product_name: p.productName,
      model_number: p.modelNumber,
      specification: p.specification,
      retail_price: p.retailPrice,
      labor_price: p.laborPrice,
      unit: p.unit,
      price_grade: p.priceGrade,
      thumbnail_url: thumbnailUrl,
      texture_url: thumbnailUrl,  // 초기엔 thumbnail = texture
      dominant_colors: p.dominantColors,
      pattern_type: p.patternType,
      surface_finish: p.surfaceFinish,
      material_texture: p.materialTexture,
      color_name: p.colorName,
      data_source: p.sourceUrl || parsedDir,
      is_verified: false,
    });

    if (error) {
      console.error(`[db] Insert failed: ${p.brand} ${p.productName}`, error.message);
    } else {
      imported++;
      console.log(`[db] Imported: ${p.brand} ${p.productName}`);
    }
  }

  console.log(`\n완료: ${imported}개 저장, ${skipped}개 스킵`);
}
```

### 3-5. 전체 파이프라인 실행기

```typescript
// scripts/run-full-pipeline.ts

import { TARGETS } from "./crawlers/crawl-config";
import { crawlTarget } from "./crawlers/crawler-engine";
import { parseProducts } from "./parsers/parse-with-gemini";
import { importProducts } from "./importers/import-to-supabase";

async function main() {
  const args = process.argv.slice(2);
  const brandArg = args.find(a => a.startsWith("--brand="))?.split("=")[1];
  const runAll = args.includes("--all");

  const targets = brandArg
    ? TARGETS.filter(t => t.id === brandArg)
    : runAll
    ? TARGETS
    : [];

  if (targets.length === 0) {
    console.log("사용법:");
    console.log("  npx tsx scripts/run-full-pipeline.ts --brand=dongwha");
    console.log("  npx tsx scripts/run-full-pipeline.ts --all");
    console.log("\n가능한 브랜드:", TARGETS.map(t => t.id).join(", "));
    return;
  }

  for (const target of targets) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Pipeline] ${target.name} (${target.id})`);
    console.log("=".repeat(60));

    // Step 1: 크롤링
    console.log("\n[1/3] 크롤링...");
    await crawlTarget(target);

    // Step 2: Gemini 파싱
    console.log("\n[2/3] Gemini 구조화 파싱...");
    await parseProducts(`raw-data/${target.id}`);

    // Step 3: DB 저장
    console.log("\n[3/3] Supabase 저장...");
    await importProducts(`parsed-data/${target.id}`);

    console.log(`\n[Pipeline] ${target.name} 완료!`);
  }
}

main().catch(console.error);
```

---

## 4. 오늘의집 시공사례 크롤러 (YOLO 학습 데이터)

```typescript
// scripts/crawlers/crawl-ohouse.ts

/**
 * 오늘의집 시공사례 사진 수집 (YOLO 학습 데이터용)
 * 대상: 시공사례 게시판 → 방별 사진 → 라벨 정보
 * 
 * 오늘의집 API 구조:
 * GET https://ohou.se/cards/feed?type=project&page=1&per=20
 */

import { chromium } from "playwright";
import fs from "fs/promises";

const OUTPUT_DIR = "raw-data/ohouse-photos";
const TARGET_COUNT = 5000;

async function crawlOhousePhotos() {
  await fs.mkdir(`${OUTPUT_DIR}/images`, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let collected = 0;
  let pageNum = 1;

  while (collected < TARGET_COUNT) {
    const url = `https://ohou.se/projects?page=${pageNum}&per=20&order=recent`;
    await page.goto(url, { waitUntil: "networkidle" });

    // 시공사례 카드 링크 수집
    const projectLinks = await page.$$eval(
      "a[href*='/projects/']",
      (els) => els.map(el => el.getAttribute("href")).filter(Boolean)
    );

    for (const link of projectLinks) {
      if (collected >= TARGET_COUNT) break;

      try {
        await page.goto(`https://ohou.se${link}`, { waitUntil: "networkidle" });

        // 사진 URL 수집
        const images = await page.$$eval(
          ".project-content img[src*='image']",
          (imgs) => imgs.map(img => img.getAttribute("src")).filter(Boolean)
        );

        // 방 타입 태그 수집
        const tags = await page.$$eval(
          ".project-tag",
          (els) => els.map(el => el.textContent?.trim()).filter(Boolean)
        );

        for (const imgUrl of images.slice(0, 5)) {  // 프로젝트당 최대 5장
          const imgRes = await fetch(imgUrl!);
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const fileName = `ohouse-${collected}.jpg`;
          await fs.writeFile(`${OUTPUT_DIR}/images/${fileName}`, buffer);

          collected++;
          if (collected % 100 === 0) {
            console.log(`[ohouse] ${collected}/${TARGET_COUNT} collected`);
          }
        }

        await new Promise(r => setTimeout(r, 3000));  // Rate limit
      } catch (e) {
        // 개별 페이지 실패는 무시
      }
    }

    pageNum++;
  }

  await browser.close();
  console.log(`[ohouse] Total: ${collected} photos collected`);
}
```

---

## 5. 파일 구조

```
scripts/
├── crawlers/
│   ├── crawl-config.ts              ← 사이트별 설정
│   ├── crawler-engine.ts            ← 공통 크롤링 엔진
│   ├── crawl-dongwha.ts             ← 동화자연마루 (커스텀)
│   ├── crawl-lx-hausys.ts           ← LX하우시스 (커스텀)
│   ├── crawl-hanssem.ts             ← 한샘 (커스텀)
│   ├── crawl-toto.ts                ← TOTO (커스텀)
│   ├── crawl-ohouse.ts              ← 오늘의집 시공사진
│   └── crawl-naver-price.ts         ← 네이버 쇼핑 가격
│
├── parsers/
│   ├── parse-with-gemini.ts         ← Gemini 구조화 파싱
│   ├── parse-catalog-pdf.ts         ← PDF 카탈로그 → 제품 추출
│   └── extract-colors.ts            ← 이미지 dominant color 추출
│
├── importers/
│   ├── import-to-supabase.ts        ← DB + Storage 저장
│   ├── generate-embeddings.ts       ← CLIP 임베딩 생성 (Stage 3)
│   └── validate-products.ts         ← 데이터 품질 검증
│
├── run-full-pipeline.ts             ← 전체 실행기
│
├── raw-data/                        ← 크롤링 원시 데이터 (.gitignore)
│   ├── dongwha/
│   ├── toto/
│   └── ohouse-photos/
│
└── parsed-data/                     ← 파싱된 데이터 (.gitignore)
    ├── dongwha/
    └── toto/
```

---

## 6. 실행 방법

```bash
# 단일 브랜드 전체 파이프라인
npx tsx scripts/run-full-pipeline.ts --brand=dongwha

# 전 브랜드 일괄
npx tsx scripts/run-full-pipeline.ts --all

# 개별 단계 실행
npx tsx scripts/crawlers/crawl-dongwha.ts
npx tsx scripts/parsers/parse-with-gemini.ts --source=raw-data/dongwha
npx tsx scripts/importers/import-to-supabase.ts --source=parsed-data/dongwha

# 오늘의집 시공사진 수집 (YOLO 학습용)
npx tsx scripts/crawlers/crawl-ohouse.ts

# 가격 업데이트 (분기별)
npx tsx scripts/crawlers/crawl-naver-price.ts --update-existing
```

---

## 7. 크롤링 주기

| 작업 | 주기 | 자동화 | 비고 |
|------|------|--------|------|
| 신제품 크롤링 | 월 1회 | 수동 실행 | 제조사 신제품 출시 |
| 가격 업데이트 | 분기 1회 | 수동 실행 | 물가 변동 반영 |
| 시공사진 수집 | 주 1회 | Cron 가능 | YOLO 학습 데이터 |
| 단종 제품 체크 | 분기 1회 | 수동 | URL 접근 불가 확인 |

---

## 8. 체크리스트

- [ ] crawl-config.ts 사이트별 설정 작성
- [ ] crawler-engine.ts 공통 엔진 구현
- [ ] 1순위 크롤러 3개 (동화/TOTO/이눅스)
- [ ] parse-with-gemini.ts 구조화 파싱
- [ ] import-to-supabase.ts DB 저장
- [ ] Supabase Storage "material-images" 버킷 생성
- [ ] run-full-pipeline.ts 통합 실행기
- [ ] 1순위 130개 제품 수집 + 저장 테스트
- [ ] 2순위 크롤러 4개 (LX/한샘/대림/영림)
- [ ] 2순위 370개 제품 수집
- [ ] 오늘의집 시공사진 크롤러
- [ ] 전체 500개 데이터 품질 검증
- [ ] .gitignore에 raw-data/, parsed-data/ 추가
