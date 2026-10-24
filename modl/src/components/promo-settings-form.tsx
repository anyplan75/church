"use client";

import { useState } from "react";
import { savePromoAction } from "@/server/promo/actions";
import type { PromoContent, YoutubePost } from "@/promo/rules";

const FIELD = "w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

/** 관리자 설정입니다. 홍보 페이지의 인스타그램과 유튜브 글만 고칩니다. */
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
      <p className="leading-relaxed text-[#5c5148]">게시판 글은 여기서 넣지 않습니다. 홍보 페이지에서 구성원이 씁니다.</p>
      <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
        홍보 페이지 저장
      </button>
    </form>
  );
}
