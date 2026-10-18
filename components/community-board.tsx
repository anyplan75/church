"use client";

import { useCallback, useEffect, useState } from "react";
import {
  categoryLabel,
  COMMUNITY_SIDO,
  POST_CATEGORIES,
  regionLabel,
  type CommunityComment,
  type CommunityMembership,
  type CommunityPost,
  type CommunityResource,
  type PostCategory,
} from "@/lib/community";
import {
  createComment,
  createPost,
  createResource,
  loadComments,
  loadMembership,
  loadPosts,
  loadResources,
  saveMembership,
} from "@/lib/community-db";
import { isMobileOperatorApp } from "@/lib/mobile-app";

type Section = "feed" | "resources" | "promo";

function formatWhen(ms: number): string {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function CommunityBoard() {
  const mobile = isMobileOperatorApp();
  const [membership, setMembership] = useState<CommunityMembership | null>(null);
  const [sido, setSido] = useState<string>("제주");
  const [district, setDistrict] = useState("");
  const [section, setSection] = useState<Section>("feed");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [resources, setResources] = useState<CommunityResource[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);

  const regionId = membership?.regionId ?? "";

  const refreshLists = useCallback(async (id: string) => {
    if (!id) {
      setPosts([]);
      setResources([]);
      return;
    }
    const [nextPosts, nextResources] = await Promise.all([loadPosts(id), loadResources(id)]);
    setPosts(nextPosts);
    setResources(nextResources);
  }, []);

  useEffect(() => {
    if (mobile) return;
    let cancel = false;
    void loadMembership()
      .then((row) => {
        if (cancel) return;
        setMembership(row);
        if (row) {
          setSido(row.sido);
          setDistrict(row.district);
          return refreshLists(row.regionId);
        }
      })
      .catch((error: Error) => {
        if (!cancel) setNotice(error.message || "불러오지 못했습니다.");
      });
    return () => {
      cancel = true;
    };
  }, [mobile, refreshLists]);

  if (mobile) {
    return (
      <p className="mt-3 rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
        iPhone·iPad 조작 앱에서는 커뮤니티를 쓰지 않습니다. 데스크톱·웹에서 열어 주세요.
      </p>
    );
  }

  async function joinRegion() {
    setBusy(true);
    setNotice("");
    try {
      const row = await saveMembership(sido, district);
      setMembership(row);
      await refreshLists(row.regionId);
      setNotice(`${regionLabel(row.sido, row.district)} 커뮤니티에 들어왔습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPost(form: FormData) {
    if (!regionId) return;
    setBusy(true);
    setNotice("");
    try {
      const category = String(form.get("category") || "") as PostCategory;
      await createPost(regionId, String(form.get("title") || ""), String(form.get("body") || ""), category);
      await refreshLists(regionId);
      setNotice("글을 올렸습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "글을 올리지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function submitResource(form: FormData) {
    if (!regionId) return;
    setBusy(true);
    setNotice("");
    try {
      await createResource(regionId, String(form.get("title") || ""), String(form.get("url") || ""), String(form.get("note") || ""));
      await refreshLists(regionId);
      setNotice("자료를 올렸습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "자료를 올리지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function openComments(postId: string) {
    if (!regionId) return;
    if (openPostId === postId) {
      setOpenPostId(null);
      setComments([]);
      return;
    }
    setOpenPostId(postId);
    setNotice("");
    try {
      setComments(await loadComments(regionId, postId));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "댓글을 불러오지 못했습니다.");
    }
  }

  async function submitComment(postId: string, form: FormData) {
    if (!regionId) return;
    setBusy(true);
    setNotice("");
    try {
      await createComment(regionId, postId, String(form.get("body") || ""));
      setComments(await loadComments(regionId, postId));
      setNotice("댓글을 남겼습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "댓글을 남기지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const feedPosts = posts.filter((post) => post.category !== "promo");
  const promoPosts = posts.filter((post) => post.category === "promo");
  const shown = section === "promo" ? promoPosts : feedPosts;

  return (
    <div className="mt-6 space-y-6">
      <section className="card p-5">
        <h2 className="font-serif text-2xl">내 지역</h2>
        <p className="mt-1 text-sm text-muted">시·도와 시·군·구를 고르면 그 지역 커뮤니티에 들어갑니다.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="field">
            <span>시·도</span>
            <select className="select" value={sido} onChange={(event) => setSido(event.target.value)}>
              {COMMUNITY_SIDO.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>시·군·구 (선택)</span>
            <input className="input" value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="예: 서귀포시" maxLength={24} />
          </label>
          <div className="flex items-end">
            <button type="button" className="btn" disabled={busy} onClick={() => void joinRegion()}>
              {membership ? "지역 바꾸기" : "들어가기"}
            </button>
          </div>
        </div>
        {membership ? (
          <p className="mt-3 text-sm text-pine">지금: {regionLabel(membership.sido, membership.district)}</p>
        ) : null}
      </section>

      {!membership ? (
        <p className="text-muted">지역을 먼저 정하면 피드·자료실·홍보를 볼 수 있습니다.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="커뮤니티 구역">
            {(
              [
                { id: "feed", label: "피드" },
                { id: "resources", label: "자료실" },
                { id: "promo", label: "홍보" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={section === item.id}
                className={`rounded-full px-4 py-2 text-sm ${section === item.id ? "bg-pine-soft font-semibold text-pine" : "border border-line text-muted hover:text-ink"}`}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {section === "feed" || section === "promo" ? (
            <section className="space-y-4">
              <form
                className="card grid gap-3 p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const el = event.currentTarget;
                  const form = new FormData(el);
                  void submitPost(form).then(() => el.reset());
                }}
              >
                <h2 className="font-serif text-2xl">{section === "promo" ? "행사·예배 홍보" : "글 쓰기"}</h2>
                <label className="field">
                  <span>종류</span>
                  <select className="select" name="category" defaultValue={section === "promo" ? "promo" : "share"}>
                    {(section === "promo" ? POST_CATEGORIES.filter((item) => item.id === "promo") : POST_CATEGORIES.filter((item) => item.id !== "promo")).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>제목</span>
                  <input className="input" name="title" required maxLength={80} />
                </label>
                <label className="field">
                  <span>내용</span>
                  <textarea className="textarea" name="body" required maxLength={4000} />
                </label>
                <button type="submit" className="btn" disabled={busy}>
                  올리기
                </button>
              </form>

              <div className="space-y-3">
                {shown.length === 0 ? <p className="text-muted">아직 글이 없습니다.</p> : null}
                {shown.map((post) => (
                  <article key={post.id} className="card p-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xs font-semibold text-pine">{categoryLabel(post.category)}</span>
                      <h3 className="font-serif text-xl">{post.title}</h3>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{post.body}</p>
                    <p className="mt-2 text-xs text-muted">
                      {post.authorEmail} · {formatWhen(post.createdAt)}
                    </p>
                    <button type="button" className="btn btn-quiet btn-small mt-3" onClick={() => void openComments(post.id)}>
                      {openPostId === post.id ? "댓글 닫기" : "댓글"}
                    </button>
                    {openPostId === post.id ? (
                      <div className="mt-3 space-y-2 border-t border-line pt-3">
                        {comments.length === 0 ? <p className="text-sm text-muted">댓글이 없습니다.</p> : null}
                        {comments.map((comment) => (
                          <div key={comment.id} className="text-sm">
                            <p className="whitespace-pre-wrap">{comment.body}</p>
                            <p className="text-xs text-muted">
                              {comment.authorEmail} · {formatWhen(comment.createdAt)}
                            </p>
                          </div>
                        ))}
                        <form
                          className="flex flex-wrap gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const el = event.currentTarget;
                            const form = new FormData(el);
                            void submitComment(post.id, form).then(() => el.reset());
                          }}
                        >
                          <input className="input min-w-0 flex-1" name="body" placeholder="댓글" required maxLength={1000} />
                          <button type="submit" className="btn btn-small" disabled={busy}>
                            남기기
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {section === "resources" ? (
            <section className="space-y-4">
              <form
                className="card grid gap-3 p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const el = event.currentTarget;
                  const form = new FormData(el);
                  void submitResource(form).then(() => el.reset());
                }}
              >
                <h2 className="font-serif text-2xl">자료 올리기</h2>
                <p className="text-sm text-muted">링크와 짧은 설명만 저장합니다. 성경 txt 전문은 올리지 마세요.</p>
                <label className="field">
                  <span>이름</span>
                  <input className="input" name="title" required maxLength={80} />
                </label>
                <label className="field">
                  <span>링크</span>
                  <input className="input" name="url" required placeholder="https://" maxLength={500} />
                </label>
                <label className="field">
                  <span>메모</span>
                  <input className="input" name="note" maxLength={200} />
                </label>
                <button type="submit" className="btn" disabled={busy}>
                  올리기
                </button>
              </form>
              <div className="space-y-3">
                {resources.length === 0 ? <p className="text-muted">공유된 자료가 없습니다.</p> : null}
                {resources.map((item) => (
                  <article key={item.id} className="card p-4">
                    <h3 className="font-serif text-xl">
                      <a href={item.url} target="_blank" rel="noreferrer" className="text-pine underline-offset-2 hover:underline">
                        {item.title}
                      </a>
                    </h3>
                    {item.note ? <p className="mt-1 text-sm text-muted">{item.note}</p> : null}
                    <p className="mt-2 text-xs text-muted">
                      {item.authorEmail} · {formatWhen(item.createdAt)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {notice ? <p className="text-sm text-pine">{notice}</p> : null}
    </div>
  );
}
