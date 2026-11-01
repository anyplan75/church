/**
 * 주일 기별 블록 규칙입니다.
 * 데이터베이스에 접속하지 않습니다. 화면과 서버가 같은 규칙을 씁니다.
 */

import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
const shortText = z.string().max(200);
const longText = z.string().max(4000);

const orderBlockSchema = z
  .object({
    id: idSchema,
    type: z.literal("order"),
    items: z
      .array(
        z
          .object({
            id: idSchema,
            label: shortText,
            detail: z.string().max(500),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

const sermonBlockSchema = z
  .object({
    id: idSchema,
    type: z.literal("sermon"),
    title: shortText,
    scripture: z.string().max(500),
    preacher: z.string().max(120),
  })
  .strict();

const officersBlockSchema = z
  .object({
    id: idSchema,
    type: z.literal("officers"),
    people: z
      .array(
        z
          .object({
            id: idSchema,
            duty: z.string().max(80),
            name: z.string().max(80),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

const praiseBlockSchema = z
  .object({
    id: idSchema,
    type: z.literal("praise"),
    songs: z
      .array(
        z
          .object({
            id: idSchema,
            title: shortText,
            scoreUrl: z.string().max(1000),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

const announcementBlockSchema = z
  .object({
    id: idSchema,
    type: z.literal("announcement"),
    body: longText,
  })
  .strict();

export const bulletinBlockSchema = z.discriminatedUnion("type", [
  orderBlockSchema,
  sermonBlockSchema,
  officersBlockSchema,
  praiseBlockSchema,
  announcementBlockSchema,
]);

export const bulletinBlocksSchema = z.array(bulletinBlockSchema).max(30);

export type BulletinBlock = z.infer<typeof bulletinBlockSchema>;
export type BlockType = BulletinBlock["type"];

export const BLOCK_TYPES = ["order", "sermon", "officers", "praise", "announcement"] as const;

/** 악보 주소는 http 또는 https 만 그림으로 보여 줍니다. */
export function safeScoreUrl(value: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseBlocks(input: unknown): { ok: true; blocks: BulletinBlock[] } | { ok: false; message: string } {
  const parsed = bulletinBlocksSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "주보 블록 모양이 맞지 않습니다. 순서와 내용을 다시 확인해 주세요." };
  }
  for (const block of parsed.data) {
    if (block.type !== "praise") continue;
    for (const song of block.songs) {
      if (song.scoreUrl.trim() && !safeScoreUrl(song.scoreUrl)) {
        return { ok: false, message: "악보 주소는 http 또는 https 로 시작하는 주소만 쓸 수 있습니다." };
      }
    }
  }
  return { ok: true, blocks: parsed.data };
}

/** 블록 순서를 한 칸 옮깁니다. 맨 끝에서는 그대로 둡니다. 배열 원본은 바꾸지 않습니다. */
export function moveBlock(blocks: readonly BulletinBlock[], index: number, direction: -1 | 1): BulletinBlock[] {
  const next = index + direction;
  if (index < 0 || index >= blocks.length || next < 0 || next >= blocks.length) {
    return [...blocks];
  }
  const copy = [...blocks];
  const current = copy[index];
  copy[index] = copy[next];
  copy[next] = current;
  return copy;
}

export function createBlock(type: BlockType, id: string): BulletinBlock {
  if (type === "order") {
    return { id, type, items: [{ id: `${id}-item`, label: "", detail: "" }] };
  }
  if (type === "sermon") {
    return { id, type, title: "", scripture: "", preacher: "" };
  }
  if (type === "officers") {
    return { id, type, people: [{ id: `${id}-person`, duty: "", name: "" }] };
  }
  if (type === "praise") {
    return { id, type, songs: [{ id: `${id}-song`, title: "", scoreUrl: "" }] };
  }
  return { id, type: "announcement", body: "" };
}

export type ShareState = {
  isPublic: boolean;
  shareToken: string | null;
};

/**
 * 발행할 때만 공개 표식을 만듭니다.
 * 이미 표식이 있으면 다시 만들지 않습니다. 비공개로 돌려도 표식은 남깁니다.
 */
export function nextShareState(
  current: ShareState,
  intent: "save" | "publish" | "unpublish",
  makeToken: () => string,
): ShareState {
  if (intent === "save") {
    return { isPublic: current.isPublic, shareToken: current.shareToken };
  }
  if (intent === "unpublish") {
    return { isPublic: false, shareToken: current.shareToken };
  }
  return {
    isPublic: true,
    shareToken: current.shareToken ?? makeToken(),
  };
}

export type PublicBulletinFields = {
  title: string;
  description: string;
};

/** 공개이고 표식이 요청과 같을 때만 제목과 설명을 돌려줍니다. */
export function publicShareFields(
  bulletin: {
    sermonTitle: string;
    worshipDate: string;
    preacher: string;
    scriptureText: string;
    isPublic: boolean;
    shareToken: string | null;
  } | null,
  token: string,
): PublicBulletinFields | null {
  if (!token || !bulletin || !bulletin.isPublic || !bulletin.shareToken || bulletin.shareToken !== token) {
    return null;
  }
  const title = bulletin.sermonTitle.trim() || "주일 기별";
  const description = [bulletin.worshipDate, bulletin.preacher.trim(), bulletin.scriptureText.trim()]
    .filter((part) => part.length > 0)
    .join(" · ")
    .slice(0, 180);
  return { title, description };
}

export type KakaoShareConfig = {
  javascriptKey: string;
  templateId: string | null;
};

/** 환경 값만 읽습니다. 키가 비어 있으면 카카오 공유가 없는 것으로 봅니다. */
export function kakaoConfigFromEnv(env: {
  KAKAO_JAVASCRIPT_KEY?: string;
  KAKAO_SHARE_TEMPLATE_ID?: string;
}): KakaoShareConfig | null {
  const javascriptKey = env.KAKAO_JAVASCRIPT_KEY?.trim() ?? "";
  if (!javascriptKey) return null;
  const templateRaw = env.KAKAO_SHARE_TEMPLATE_ID?.trim() ?? "";
  const templateId = /^[1-9][0-9]*$/.test(templateRaw) ? templateRaw : null;
  return { javascriptKey, templateId };
}
