/**
 * INPICK EXPO — Brand URL Importer (블루프린트 §3.2/§7.4).
 *
 * 불변조건:
 *   - 이 모듈은 "후보"만 만든다 — 어떤 후보도 자동 확정하지 않는다.
 *     확정(사용/제외/교체)과 사용 권한 확인은 항상 사용자의 행위다.
 *   - 출처(source URL/retrieved time)는 후보에 항상 붙어 다닌다.
 *   - 순수 함수 — 네트워크는 API 라우트가 담당한다.
 */

export const EXPO_BRAND_MAX_CANDIDATES = 6;

export interface ExpoBrandCandidates {
  title: string | null;
  description: string | null;
  siteName: string | null;
  /** 절대 https URL, 중복 제거, 최대 6개 */
  logoCandidates: string[];
  /** #rrggbb 소문자, 중복 제거, 최대 6개 */
  colorCandidates: string[];
  sourceUrl: string;
  retrievedAt: string;
}

/** 사용자가 확정한 브랜드 킷 — rightsConfirmed는 사용자의 권한 보유 확인. */
export interface ExpoBrandKit {
  name: string | null;
  logoUrl: string | null;
  colorHex: string | null;
  sourceUrl: string;
  retrievedAt: string;
  rightsConfirmed: true;
}

export function isExpoBrandKit(value: unknown): value is ExpoBrandKit {
  if (!value || typeof value !== "object") return false;
  const kit = value as ExpoBrandKit;
  return (
    kit.rightsConfirmed === true &&
    typeof kit.sourceUrl === "string" &&
    typeof kit.retrievedAt === "string" &&
    (kit.name === null || typeof kit.name === "string") &&
    (kit.logoUrl === null || typeof kit.logoUrl === "string") &&
    (kit.colorHex === null || /^#[0-9a-f]{6}$/.test(String(kit.colorHex)))
  );
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** 태그 문자열에서 속성값 추출 (따옴표 종류/순서 무관) */
function attrValue(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"),
  );
  if (!match) return null;
  return (match[2] ?? match[3] ?? "").trim();
}

function normalizeHex(value: string): string | null {
  const raw = value.trim().toLowerCase();
  const full = raw.match(/^#([0-9a-f]{6})$/);
  if (full) return `#${full[1]}`;
  const short = raw.match(/^#([0-9a-f]{3})$/);
  if (short) {
    const r = short[1][0];
    const g = short[1][1];
    const b = short[1][2];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

function resolveHttpsUrl(href: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(href, baseUrl);
    if (resolved.protocol !== "https:") return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

export function extractBrandCandidates(
  html: string,
  baseUrl: string,
  retrievedAt: string,
): ExpoBrandCandidates {
  const head = html.slice(0, 500_000);

  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch ? decodeEntities(titleMatch[1]).slice(0, 200) : null;
  if (title === "") title = null;

  let description: string | null = null;
  let siteName: string | null = null;
  const logoSet = new Set<string>();
  const colorSet = new Set<string>();

  const metaTags = head.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const key = (attrValue(tag, "property") ?? attrValue(tag, "name") ?? "")
      .toLowerCase();
    const content = attrValue(tag, "content");
    if (!content) continue;
    if (!description && (key === "description" || key === "og:description")) {
      description = decodeEntities(content).slice(0, 300) || null;
    }
    if (!siteName && key === "og:site_name") {
      siteName = decodeEntities(content).slice(0, 100) || null;
    }
    if (key === "og:image" || key === "og:image:url" || key === "twitter:image") {
      const resolved = resolveHttpsUrl(content, baseUrl);
      if (resolved) logoSet.add(resolved);
    }
    if (key === "theme-color" || key === "msapplication-tilecolor") {
      const hex = normalizeHex(content);
      if (hex) colorSet.add(hex);
    }
  }

  const linkTags = head.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const rel = (attrValue(tag, "rel") ?? "").toLowerCase();
    if (!/(^|\s)(icon|shortcut icon|apple-touch-icon|mask-icon)(\s|$)/.test(rel)) {
      continue;
    }
    const href = attrValue(tag, "href");
    if (!href) continue;
    const resolved = resolveHttpsUrl(href, baseUrl);
    if (resolved) logoSet.add(resolved);
  }

  // 파일명/alt에 logo가 들어간 img 후보 (본문 앞부분만)
  const imgTags = head.match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of imgTags) {
    if (logoSet.size >= EXPO_BRAND_MAX_CANDIDATES) break;
    const src = attrValue(tag, "src");
    const alt = (attrValue(tag, "alt") ?? "").toLowerCase();
    if (!src) continue;
    if (!/logo/i.test(src) && !alt.includes("logo")) continue;
    const resolved = resolveHttpsUrl(src, baseUrl);
    if (resolved) logoSet.add(resolved);
  }

  return {
    title,
    description,
    siteName,
    logoCandidates: Array.from(logoSet).slice(0, EXPO_BRAND_MAX_CANDIDATES),
    colorCandidates: Array.from(colorSet).slice(0, EXPO_BRAND_MAX_CANDIDATES),
    sourceUrl: baseUrl,
    retrievedAt,
  };
}
