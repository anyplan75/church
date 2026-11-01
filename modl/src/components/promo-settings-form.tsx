"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { savePromoAction } from "@/server/promo/actions";
import type { BoardTab, PromoContent, YoutubePost } from "@/promo/rules";

const FIELD = "w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

/** 관리자 설정입니다. 홍보 페이지의 인스타그램, 유튜브 글, 게시판만 고칩니다. */
export function PromoSettingsForm({
  kind,
  id,
  content,
}: {
  kind: "church" | "gathering";
  id: string;
  content: PromoContent;
}) {
  const [youtube, setYoutube] = useState<YoutubePost[]>(content.youtube.length > 0 ? content.youtube : [{ title: "", url: "" }]);
  const [tabs, setTabs] = useState<BoardTab[]>(content.tabs.length > 0 ? content.tabs : [{ title: "", posts: [{ title: "", body: "" }] }]);

  return (
    <form action={savePromoAction} className="grid gap-4" data-testid="promo-settings-form">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="placeId" value={id} />
      <label className="grid gap-1">
        <span className="font-semibold">인스타그램 계정</span>
        <input name="instagram" defaultValue={content.instagram} placeholder="계정 또는 주소" className={FIELD} />
      </label>
      <fieldset className="grid gap-2">
        <legend className="font-semibold">유튜브 글</legend>
        {youtube.map((row, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-2">
            <input name="youtubeTitle" value={row.title} placeholder="제목" className={FIELD} onChange={(event) => setYoutube((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value } : item)))} />
            <input name="youtubeUrl" value={row.url} placeholder="https://youtu.be/..." className={FIELD} onChange={(event) => setYoutube((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, url: event.target.value } : item)))} />
          </div>
        ))}
        {youtube.length < 12 ? (
          <button type="button" className="w-fit rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold" onClick={() => setYoutube((current) => [...current, { title: "", url: "" }])}>
            유튜브 글 추가
          </button>
        ) : null}
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="font-semibold">게시판</legend>
        <p className="leading-relaxed text-[#5c5148]">이 교회나 이 모들의 글만 둡니다. 탭은 3개까지입니다.</p>
        {tabs.map((tab, tabIndex) => (
          <div key={tabIndex} className="grid gap-2 rounded-2xl bg-white px-3 py-3">
            <input name="tabTitle" value={tab.title} placeholder="탭 이름" className={FIELD} onChange={(event) => setTabs((current) => current.map((item, itemIndex) => (itemIndex === tabIndex ? { ...item, title: event.target.value } : item)))} />
            {tab.posts.map((post, postIndex) => (
              <div key={postIndex} className="grid gap-2">
                <input type="hidden" name="postTab" value={String(tabIndex)} />
                <input name="postTitle" value={post.title} placeholder="글 제목" className={FIELD} onChange={(event) => updatePost(setTabs, tabIndex, postIndex, { title: event.target.value })} />
                <textarea name="postBody" value={post.body} placeholder="글 내용" rows={3} className={FIELD} onChange={(event) => updatePost(setTabs, tabIndex, postIndex, { body: event.target.value })} />
              </div>
            ))}
            {tab.posts.length < 30 ? (
              <button type="button" className="w-fit rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 text-sm font-semibold" onClick={() => setTabs((current) => current.map((item, itemIndex) => (itemIndex === tabIndex ? { ...item, posts: [...item.posts, { title: "", body: "" }] } : item)))}>
                글 추가
              </button>
            ) : null}
          </div>
        ))}
        {tabs.length < 3 ? (
          <button type="button" className="w-fit rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold" onClick={() => setTabs((current) => [...current, { title: "", posts: [{ title: "", body: "" }] }])}>
            탭 추가
          </button>
        ) : null}
      </fieldset>
      <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
        홍보 페이지 저장
      </button>
    </form>
  );
}

function updatePost(
  setTabs: Dispatch<SetStateAction<BoardTab[]>>,
  tabIndex: number,
  postIndex: number,
  patch: { title?: string; body?: string },
) {
  setTabs((current) =>
    current.map((tab, index) => {
      if (index !== tabIndex) return tab;
      return {
        ...tab,
        posts: tab.posts.map((post, itemIndex) => (itemIndex === postIndex ? { ...post, ...patch } : post)),
      };
    }),
  );
}
