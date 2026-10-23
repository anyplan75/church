/**
 * 홍보 페이지에 둘 내용만 고릅니다.
 * 인스타그램 계정, 유튜브 글, 게시판 탭입니다. 탭은 3개까지입니다.
 * 일정, 재정, 출석, 주보는 여기에 넣지 않습니다.
 */

export type YoutubePost = { title: string; url: string };
export type BoardPost = { title: string; body: string };
export type BoardTab = { title: string; posts: BoardPost[] };

export type PromoContent = {
  instagram: string;
  youtube: YoutubePost[];
  tabs: BoardTab[];
};

export type PlaceMenuItem = {
  href: string;
  label: string;
  kind: "church" | "gathering";
};

export function subscriptionMenus(
  churches: readonly { id: string; name: string }[],
  gatherings: readonly { id: string; name: string }[],
): PlaceMenuItem[] {
  return [
    ...churches.map((row) => ({ href: `/promo/church/${row.id}`, label: row.name, kind: "church" as const })),
    ...gatherings.map((row) => ({ href: `/promo/gathering/${row.id}`, label: row.name, kind: "gathering" as const })),
  ];
}

export function cleanIntro(text: string): { ok: true; intro: string } | { ok: false; message: string } {
  const intro = text.trim();
  if (intro.length > 500) return { ok: false, message: "소개는 500자 안으로 적어 주세요." };
  return { ok: true, intro };
}

export function cleanPromo(input: {
  instagram: string;
  youtube: readonly { title: string; url: string }[];
  tabs: readonly { title: string; posts: readonly { title: string; body: string }[] }[];
}): { ok: true; content: PromoContent } | { ok: false; message: string } {
  const instagram = input.instagram.trim();
  if (instagram.length > 80) return { ok: false, message: "인스타그램 계정은 짧게 적어 주세요." };
  const youtube: YoutubePost[] = [];
  for (const row of input.youtube) {
    const title = row.title.trim();
    const url = row.url.trim();
    if (!title && !url) continue;
    if (!title || !url) return { ok: false, message: "유튜브 글은 제목과 주소를 함께 적어 주세요." };
    if (title.length > 80) return { ok: false, message: "유튜브 제목은 짧게 적어 주세요." };
    if (!isYoutubeUrl(url)) return { ok: false, message: "유튜브 주소만 넣을 수 있습니다." };
    youtube.push({ title, url });
  }
  if (youtube.length > 12) return { ok: false, message: "유튜브 글은 12개까지입니다." };
  const tabs: BoardTab[] = [];
  for (const tab of input.tabs) {
    const title = tab.title.trim();
    const posts: BoardPost[] = [];
    for (const post of tab.posts) {
      const postTitle = post.title.trim();
      const body = post.body.trim();
      if (!postTitle && !body) continue;
      if (!postTitle || !body) return { ok: false, message: "게시판 글은 제목과 내용을 함께 적어 주세요." };
      if (postTitle.length > 80 || body.length > 2000) return { ok: false, message: "게시판 글은 짧게 적어 주세요." };
      posts.push({ title: postTitle, body });
    }
    if (!title && posts.length === 0) continue;
    if (!title) return { ok: false, message: "게시판 탭 이름을 적어 주세요." };
    if (title.length > 40) return { ok: false, message: "탭 이름은 짧게 적어 주세요." };
    if (posts.length > 30) return { ok: false, message: "한 탭의 글은 30개까지입니다." };
    tabs.push({ title, posts });
  }
  if (tabs.length > 3) return { ok: false, message: "게시판 탭은 3개까지입니다." };
  return { ok: true, content: { instagram, youtube, tabs } };
}

export function readPromoContent(youtubeJson: unknown, tabsJson: unknown, instagram: string): PromoContent {
  const cleaned = cleanPromo({
    instagram,
    youtube: readYoutube(youtubeJson),
    tabs: readTabs(tabsJson),
  });
  return cleaned.ok ? cleaned.content : { instagram: "", youtube: [], tabs: [] };
}

export function instagramHref(account: string): string | null {
  const text = account.trim();
  if (!text) return null;
  if (/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/.test(text)) return text;
  const handle = text.replace(/^@/, "");
  if (/^[A-Za-z0-9._]{1,30}$/.test(handle)) return `https://instagram.com/${handle}`;
  return null;
}

export function promoTexts(content: PromoContent, intro = ""): string[] {
  return [
    content.instagram,
    intro,
    ...content.youtube.map((row) => row.title),
    ...content.tabs.flatMap((tab) => [tab.title, ...tab.posts.flatMap((post) => [post.title, post.body])]),
  ];
}

function isYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

function readYoutube(value: unknown): YoutubePost[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const title = "title" in row && typeof row.title === "string" ? row.title : "";
    const url = "url" in row && typeof row.url === "string" ? row.url : "";
    return [{ title, url }];
  });
}

function readTabs(value: unknown): BoardTab[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const title = "title" in row && typeof row.title === "string" ? row.title : "";
    const posts = "posts" in row && Array.isArray(row.posts)
      ? row.posts.flatMap((post: unknown) => {
          if (!post || typeof post !== "object") return [];
          const postTitle = "title" in post && typeof post.title === "string" ? post.title : "";
          const body = "body" in post && typeof post.body === "string" ? post.body : "";
          return [{ title: postTitle, body }];
        })
      : [];
    return [{ title, posts }];
  });
}
