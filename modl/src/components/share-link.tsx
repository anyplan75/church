"use client";

import { useEffect, useState } from "react";
import { useCommunityTerm } from "@/components/use-community-term";

type KakaoShare = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: {
    sendScrap: (settings: { requestUrl: string }) => void;
    sendCustom: (settings: { templateId: number; templateArgs: Record<string, string> }) => void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoShare;
  }
}

function loadKakaoSdk(): Promise<void> {
  if (window.Kakao) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("카카오 공유 도구를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

/** 키가 없으면 제목, 날짜, 공개 주소를 복사합니다. 키가 있으면 카카오 공유 카드를 띄웁니다. */
export function ShareLink({
  title,
  dateLabel,
  path,
  kakaoKey,
  templateId,
}: {
  title: string;
  dateLabel: string;
  path: string;
  kakaoKey: string | null;
  templateId: string | null;
}) {
  const copyTerm = useCommunityTerm("copy_share");
  const kakaoTerm = useCommunityTerm("kakao_share");
  const [url, setUrl] = useState(path);
  const [note, setNote] = useState("");

  useEffect(() => {
    setUrl(new URL(path, window.location.origin).toString());
  }, [path]);

  async function copyLink() {
    const text = `${title}\n${dateLabel}\n${url}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setNote("제목, 날짜, 공개 주소를 복사했습니다.");
        return;
      }
    } catch {
      // 브라우저가 클립보드를 막으면 아래 선택 복사로 이어 갑니다.
    }
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.left = "0";
    helper.style.top = "0";
    document.body.appendChild(helper);
    helper.focus();
    helper.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    helper.remove();
    setNote(
      copied
        ? "제목, 날짜, 공개 주소를 복사했습니다."
        : "복사가 막혀 있습니다. 아래 주소를 직접 골라 복사해 주세요.",
    );
  }

  async function shareKakao() {
    if (!kakaoKey) {
      await copyLink();
      return;
    }
    try {
      await loadKakaoSdk();
      if (!window.Kakao) throw new Error("카카오 공유 도구가 없습니다.");
      if (!window.Kakao.isInitialized()) window.Kakao.init(kakaoKey);
      if (templateId) {
        window.Kakao.Share.sendCustom({
          templateId: Number(templateId),
          templateArgs: { title, date: dateLabel, url },
        });
      } else {
        window.Kakao.Share.sendScrap({ requestUrl: url });
      }
      setNote("카카오톡 공유 카드를 띄웠습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "카카오톡 공유를 열지 못했습니다.";
      setNote(message);
    }
  }

  return (
    <div className="grid gap-3 rounded-3xl bg-[#fffaf3] px-4 py-4">
      <label className="grid gap-1">
        <span className="font-semibold leading-snug">{copyTerm.primary}</span>
        <input
          readOnly
          data-testid="public-url"
          className="w-full break-all rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
          value={url}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="copy-share"
          className="rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold leading-snug text-white"
          onClick={() => void copyLink()}
        >
          {copyTerm.primary}
        </button>
        {kakaoKey ? (
          <button
            type="button"
            data-testid="kakao-share"
            className="rounded-2xl border border-[#e4d8c8] bg-white px-4 py-3 font-semibold leading-snug"
            onClick={() => void shareKakao()}
          >
            {kakaoTerm.primary}
          </button>
        ) : null}
      </div>
      {note ? (
        <p role="status" className="leading-relaxed">
          {note}
        </p>
      ) : null}
    </div>
  );
}
