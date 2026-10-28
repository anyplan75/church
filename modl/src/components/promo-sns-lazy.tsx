"use client";

import { useEffect, useState } from "react";
import { PromoSns } from "@/components/promo-sns";
import type { InstagramFeed } from "@/server/promo/instagram-feed";
import type { YoutubeFeed } from "@/server/promo/youtube-feed";

type FeedState =
  | { status: "loading"; instagramAccount: string }
  | {
      status: "ready";
      instagramAccount: string;
      instagram: InstagramFeed | null;
      youtube: YoutubeFeed | null;
    }
  | { status: "error"; instagramAccount: string; message: string };

type PlaceProps = {
  headingLevel?: "h2" | "h3";
  kind: "church" | "gathering";
  id: string;
  instagramAccount: string;
};

type PreviewProps = {
  headingLevel?: "h2" | "h3";
  instagramAccount: string;
  youtubeUrl: string;
};

type Props = PlaceProps | PreviewProps;

function isPlace(props: Props): props is PlaceProps {
  return "kind" in props && "id" in props;
}

/**
 * 제목·게시판 껍데기를 먼저 보여 준 뒤, 인스타그램·유튜브만 나중에 채웁니다.
 * 서버가 바깥 SNS를 끝까지 기다리지 않게 합니다.
 */
export function PromoSnsLazy(props: Props) {
  const headingLevel = props.headingLevel ?? "h2";
  const accountHint = props.instagramAccount;
  const placeKind = isPlace(props) ? props.kind : "";
  const placeId = isPlace(props) ? props.id : "";
  const youtubeUrl = isPlace(props) ? "" : props.youtubeUrl;
  const [state, setState] = useState<FeedState>({ status: "loading", instagramAccount: accountHint });

  useEffect(() => {
    let alive = true;
    const url = placeKind && placeId
      ? `/api/promo/sns?${new URLSearchParams({ kind: placeKind, id: placeId })}`
      : `/api/promo/sns?${new URLSearchParams({
          ...(accountHint.trim() ? { instagram: accountHint.trim() } : {}),
          ...(youtubeUrl.trim() ? { youtube: youtubeUrl.trim() } : {}),
        })}`;
    setState({ status: "loading", instagramAccount: accountHint });
    void fetch(url, { credentials: "same-origin" })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!alive) return;
        if (
          !payload ||
          typeof payload !== "object" ||
          !("ok" in payload) ||
          payload.ok !== true ||
          !("instagram" in payload) ||
          !("youtube" in payload)
        ) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
              ? payload.message
              : "SNS 글을 읽지 못했습니다.";
          setState({ status: "error", instagramAccount: accountHint, message });
          return;
        }
        const account =
          "instagramAccount" in payload && typeof payload.instagramAccount === "string"
            ? payload.instagramAccount
            : accountHint;
        setState({
          status: "ready",
          instagramAccount: account,
          instagram: payload.instagram as InstagramFeed | null,
          youtube: payload.youtube as YoutubeFeed | null,
        });
      })
      .catch(() => {
        if (!alive) return;
        setState({ status: "error", instagramAccount: accountHint, message: "SNS 글을 읽지 못했습니다." });
      });
    return () => {
      alive = false;
    };
  }, [accountHint, placeKind, placeId, youtubeUrl]);

  if (state.status === "error") {
    return (
      <div data-testid="promo-sns-lazy-error" className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">
        {state.message}
      </div>
    );
  }

  return (
    <PromoSns
      headingLevel={headingLevel}
      loading={state.status === "loading"}
      instagramAccount={state.instagramAccount}
      instagram={state.status === "ready" ? state.instagram : null}
      youtube={state.status === "ready" ? state.youtube : null}
    />
  );
}
