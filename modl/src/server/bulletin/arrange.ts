/**
 * 규칙으로 1부·2부와 담당이 나뉘면 그 결과를 씁니다.
 * 규칙이 깨질 때만 서버에서 제미나이를 부릅니다. 열쇠가 없으면 규칙 결과를 그대로 둡니다.
 */

import { sectionAssignBroken, servicesFromBulletinText, type BulletinServiceDraft } from "@/bulletin/intake";

const DEFAULT_MODEL = "gemini-2.5-flash";

export async function arrangeBulletinServices(text: string, nextId: () => string): Promise<BulletinServiceDraft[]> {
  const ruled = servicesFromBulletinText(text, nextId);
  if (!sectionAssignBroken(text, ruled)) return ruled;
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (!apiKey) return ruled;
  try {
    const arranged = await askGemini(text, apiKey);
    if (!arranged) return ruled;
    const parsed = servicesFromBulletinText(arranged, nextId);
    if (parsed.length === 0 || sectionAssignBroken(arranged, parsed)) return ruled;
    return parsed;
  } catch {
    return ruled;
  }
}

async function askGemini(text: string, apiKey: string): Promise<string | null> {
  const model = (process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL).replace(/[^\w.-]/g, "") || DEFAULT_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptFor(text.slice(0, 30000)) }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return linesFromModel(raw);
}

function promptFor(text: string): string {
  return [
    "인쇄된 주보 글을 예배별로 나누십시오.",
    "1부와 2부처럼 섹션이 나뉘고, 같은 순서라도 담당이 다를 수 있습니다.",
    "글에 없는 제목, 이름, 시각을 만들지 마십시오.",
    "십일조, 헌금, 봉헌은 빼십시오.",
    "날짜는 2026년 10월 11일처럼 적으십시오.",
    "제목은 1부 예배, 2부 예배, 주일찬양예배, 수요기도회, 새벽기도회처럼 예배 이름을 적으십시오.",
    "순서 이름은 경배와 찬양, 예배의 부름, 찬송, 영광의 찬송, 신앙고백, 대표기도, 성도의 교제, 성경봉독, 찬양, 설교, 결단의 찬양, 축도, 인도, 기도를 유지하십시오.",
    "JSON만 반환하십시오. 모양은 {\"services\":[{\"date\":\"\",\"label\":\"\",\"time\":\"\",\"order\":[{\"label\":\"\",\"detail\":\"\"}],\"announcements\":[\"\"]}]} 입니다.",
    "",
    text,
  ].join("\n");
}

function linesFromModel(raw: string): string | null {
  const parsed = parseModel(raw);
  if (!parsed || parsed.length === 0) return null;
  const chunks: string[] = [];
  const news: string[] = [];
  for (const service of parsed) {
    const date = koreanDate(service.date ?? "");
    if (date) chunks.push(date);
    const label = clean(service.label ?? "");
    const time = clean(service.time ?? "");
    if (!label || /십일조|헌금|봉헌/.test(label)) continue;
    chunks.push([label, time].filter(Boolean).join(" "));
    for (const item of service.order ?? []) {
      const name = clean(item.label ?? "");
      const detail = clean(item.detail ?? "");
      if (!name || /십일조|헌금|봉헌/.test(`${name} ${detail}`)) continue;
      chunks.push(detail ? `${name} ${detail}` : name);
    }
    for (const line of service.announcements ?? []) {
      const body = clean(line).replace(/^[-•·]\s*/, "");
      if (body && !/십일조|헌금|봉헌/.test(body)) news.push(body);
    }
  }
  if (news.length > 0) {
    chunks.push("교회소식");
    for (const line of news) chunks.push(`- ${line}`);
  }
  const text = chunks.join("\n").trim();
  return text || null;
}

type ModelService = {
  date?: string;
  label?: string;
  time?: string;
  order?: Array<{ label?: string; detail?: string }>;
  announcements?: string[];
};

function parseModel(raw: string): ModelService[] | null {
  const trimmed = raw.replace(/```(?:json)?/gi, "").trim();
  try {
    const value = JSON.parse(trimmed) as { services?: ModelService[] } | ModelService[];
    const services = Array.isArray(value) ? value : value.services;
    return Array.isArray(services) ? services.slice(0, 12) : null;
  } catch {
    return null;
  }
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

function koreanDate(value: string): string {
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}년 ${Number(iso[2])}월 ${Number(iso[3])}일`;
  const korean = value.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!korean) return "";
  return `${korean[1]}년 ${Number(korean[2])}월 ${Number(korean[3])}일`;
}
