"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChurch } from "@/components/church-state";
import {
  BOARD_CATEGORIES,
  COMMUNITY_SIDO,
  GROUP_CATEGORIES,
  categoryLabel,
  formatCommunityWhen,
  groupCategoryMeta,
  groupRoomHref,
  nicknameFromEmail,
  postBookmarkKey,
  regionLabel,
  sortGroups,
  sortPosts,
  type BoardCategory,
  type ChatThread,
  type ChurchNotice,
  type ChurchScheduleItem,
  type CommunityComment,
  type CommunityGroup,
  type CommunityMembership,
  type CommunityPost,
  type CommunityProfile,
  type GroupCategory,
  type SortMode,
} from "@/lib/community";
import {
  bumpPostView,
  createChatShell,
  createChurchNotice,
  createChurchSchedule,
  createComment,
  createGroup,
  createPost,
  joinGroup,
  loadBookmarks,
  loadChats,
  loadChurchNotices,
  loadChurchSchedule,
  loadComments,
  loadGroups,
  loadMembership,
  loadMyGroupIds,
  loadPosts,
  loadProfile,
  requestMemberVerification,
  saveMembership,
  saveProfile,
  toggleBookmark,
  togglePostLike,
} from "@/lib/community-db";
import { isMobileOperatorApp } from "@/lib/mobile-app";
import {
  CategoryGlyph,
  IconBell,
  IconBoard,
  IconBookmark,
  IconChat,
  IconChurch,
  IconEye,
  IconHeart,
  IconMegaphone,
  IconMenu,
  IconMy,
  IconPencil,
  IconPeople,
  IconSearch,
  IconUpload,
  IconVerified,
} from "./community-icons";

export type CommunityTab = "groups" | "board" | "church" | "chat" | "my";

const TABS: { id: CommunityTab; label: string; Icon: typeof IconPeople }[] = [
  { id: "groups", label: "모임", Icon: IconPeople },
  { id: "board", label: "게시판", Icon: IconBoard },
  { id: "church", label: "나의 교회", Icon: IconChurch },
  { id: "chat", label: "채팅", Icon: IconChat },
  { id: "my", label: "MY", Icon: IconMy },
];

export function CommunityApp() {
  const { db, user, ready } = useChurch();
  const mobile = isMobileOperatorApp();
  const churchName = db?.settings.churchName || "내 교회";
  const churchId = user?.churchId || "";

  const [tab, setTab] = useState<CommunityTab>("groups");
  const [membership, setMembership] = useState<CommunityMembership | null>(null);
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [sido, setSido] = useState("제주");
  const [district, setDistrict] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [churchNotices, setChurchNotices] = useState<ChurchNotice[]>([]);
  const [schedule, setSchedule] = useState<ChurchScheduleItem[]>([]);
  const [chats, setChats] = useState<ChatThread[]>([]);

  const regionId = membership?.regionId ?? "";

  const refreshAll = useCallback(
    async (id: string, cid: string) => {
      if (!id) {
        setGroups([]);
        setPosts([]);
        setMyGroupIds(new Set());
      } else {
        const [g, p, mine, marks] = await Promise.all([
          loadGroups(id),
          loadPosts(id),
          loadMyGroupIds(id),
          loadBookmarks(),
        ]);
        setGroups(g);
        setPosts(p);
        setMyGroupIds(mine);
        setBookmarks(marks);
      }
      if (cid) {
        const [n, s] = await Promise.all([loadChurchNotices(cid), loadChurchSchedule(cid)]);
        setChurchNotices(n);
        setSchedule(s);
      }
      const [prof, threads] = await Promise.all([loadProfile(), loadChats()]);
      setProfile(prof);
      setChats(threads);
    },
    [],
  );

  useEffect(() => {
    if (mobile) return;
    let cancel = false;
    void (async () => {
      try {
        const row = await loadMembership();
        if (cancel) return;
        setMembership(row);
        if (row) {
          setSido(row.sido);
          setDistrict(row.district);
        }
        await refreshAll(row?.regionId || "", churchId);
      } catch (error) {
        if (!cancel) setNotice(error instanceof Error ? error.message : "불러오지 못했습니다.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mobile, churchId, refreshAll]);

  if (mobile) {
    return (
      <p className="mt-3 rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
        iPhone·iPad 조작 앱에서는 커뮤니티를 쓰지 않습니다. 데스크톱·웹에서 열어 주세요.
      </p>
    );
  }

  // 성도 예배정보는 비로그인 가능. 커뮤니티 읽기·쓰기는 계정 필요 — 여기서만 가볍게 유도.
  if (ready && !user) {
    return (
      <div className="mx-auto mt-8 max-w-md rounded-2xl border border-line bg-card px-5 py-6 text-center">
        <h1 className="font-serif text-2xl text-ink">커뮤니티</h1>
        <p className="mt-2 text-sm text-muted">
          모임·게시판·채팅은 로그인한 뒤 이용할 수 있습니다. 예배정보·자막은 성도 화면에서 로그인 없이 볼 수 있습니다.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login/" className="btn btn-primary">
            로그인
          </Link>
          <Link href="/member/" className="btn btn-quiet">
            성도 화면으로
          </Link>
        </div>
      </div>
    );
  }

  async function joinRegion() {
    setBusy(true);
    setNotice("");
    try {
      const row = await saveMembership(sido, district);
      setMembership(row);
      await refreshAll(row.regionId, churchId);
      setNotice(`${regionLabel(row.sido, row.district)} 커뮤니티에 들어왔습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "지역에 들어가지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="konia-root mx-auto w-full max-w-3xl overflow-hidden rounded-[1.25rem] border border-[#e8ecf2] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] sm:rounded-2xl">
      <div className="relative flex min-h-[640px] flex-col pb-[4.25rem] sm:min-h-[720px]">
        {!membership ? (
          <RegionGate
            sido={sido}
            district={district}
            busy={busy}
            notice={notice}
            onSido={setSido}
            onDistrict={setDistrict}
            onJoin={() => void joinRegion()}
          />
        ) : (
          <>
            {tab === "groups" ? (
              <GroupsTab
                membership={membership}
                groups={groups}
                myGroupIds={myGroupIds}
                churchName={churchName}
                notice={notice}
                setNotice={setNotice}
                onChangeRegion={() => setMembership(null)}
                onCreated={async () => refreshAll(regionId, churchId)}
                onJoined={(g) => {
                  setGroups((prev) => prev.map((x) => (x.id === g.id ? g : x)));
                  setMyGroupIds((prev) => new Set(prev).add(g.id));
                }}
              />
            ) : null}
            {tab === "board" ? (
              <BoardTab
                regionId={regionId}
                posts={posts}
                bookmarks={bookmarks}
                profile={profile}
                churchName={churchName}
                notice={notice}
                setNotice={setNotice}
                onPosts={setPosts}
                onBookmarks={setBookmarks}
              />
            ) : null}
            {tab === "church" ? (
              <MyChurchTab
                churchName={churchName}
                churchId={churchId}
                regionLabel={regionLabel(membership.sido, membership.district)}
                notices={churchNotices}
                schedule={schedule}
                notice={notice}
                setNotice={setNotice}
                onNotices={setChurchNotices}
                onSchedule={setSchedule}
              />
            ) : null}
            {tab === "chat" ? (
              <ChatTab
                chats={chats}
                notice={notice}
                setNotice={setNotice}
                onChats={setChats}
              />
            ) : null}
            {tab === "my" ? (
              <MyTab
                profile={profile}
                churchName={churchName}
                email={user?.email || ""}
                userId={user?.id || ""}
                posts={posts}
                bookmarks={bookmarks}
                regionId={regionId}
                notice={notice}
                setNotice={setNotice}
                onProfile={setProfile}
              />
            ) : null}
          </>
        )}

        <nav className="absolute inset-x-0 bottom-0 z-20 border-t border-[#eef1f6] bg-white/95 backdrop-blur" aria-label="커뮤니티 메뉴">
          <div className="grid grid-cols-5 px-1 pb-2 pt-1">
            {TABS.map(({ id, label, Icon }) => {
              const active = membership ? tab === id : id === "groups";
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!membership}
                  onClick={() => setTab(id)}
                  className={`flex flex-col items-center gap-0.5 py-1 text-[10px] ${active ? "font-semibold text-[#1a233a]" : "text-[#9aa3b2]"} disabled:opacity-40`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

function RegionGate({
  sido,
  district,
  busy,
  notice,
  onSido,
  onDistrict,
  onJoin,
}: {
  sido: string;
  district: string;
  busy: boolean;
  notice: string;
  onSido: (v: string) => void;
  onDistrict: (v: string) => void;
  onJoin: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-5 pt-8">
      <h2 className="text-2xl font-bold text-[#1a233a]">커뮤니티</h2>
      <p className="mt-2 text-sm text-[#6b7280]">시·도를 고르고 같은 지역 모임·게시판에 들어갑니다.</p>
      <label className="mt-6 text-xs text-[#6b7280]">
        시·도
        <select className="mt-1 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm" value={sido} onChange={(e) => onSido(e.target.value)}>
          {COMMUNITY_SIDO.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 text-xs text-[#6b7280]">
        시·군·구 (선택)
        <input
          className="mt-1 w-full rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm"
          value={district}
          onChange={(e) => onDistrict(e.target.value)}
          placeholder="예: 서귀포시"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={onJoin}
        className="mt-6 rounded-xl bg-[#1a233a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "들어가는 중…" : "들어가기"}
      </button>
      {notice ? <p className="mt-3 text-sm text-[#6b7280]">{notice}</p> : null}
    </div>
  );
}

function GroupsTab({
  membership,
  groups,
  myGroupIds,
  churchName,
  notice,
  setNotice,
  onChangeRegion,
  onCreated,
  onJoined,
}: {
  membership: CommunityMembership;
  groups: CommunityGroup[];
  myGroupIds: Set<string>;
  churchName: string;
  notice: string;
  setNotice: (v: string) => void;
  onChangeRegion: () => void;
  onCreated: () => Promise<void>;
  onJoined: (g: CommunityGroup) => void;
}) {
  const router = useRouter();
  const [sub, setSub] = useState<"all" | "mine">("all");
  const [cat, setCat] = useState<GroupCategory>("all");
  const [sort, setSort] = useState<SortMode>("popular");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [schedule, setSchedule] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [formCat, setFormCat] = useState<Exclude<GroupCategory, "all">>("hobby");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    let list = groups;
    if (sub === "mine") list = list.filter((g) => myGroupIds.has(g.id));
    if (cat !== "all") list = list.filter((g) => g.category === cat);
    return sortGroups(list, sort);
  }, [groups, myGroupIds, sub, cat, sort]);

  function openGroup(groupId: string) {
    router.push(groupRoomHref(groupId, membership.regionId));
  }

  async function submit() {
    setBusy(true);
    setNotice("");
    try {
      const created = await createGroup(membership.regionId, {
        title,
        category: formCat,
        place,
        schedule,
        capacity: Number(capacity) || 10,
        churchName,
        description,
      });
      setTitle("");
      setPlace("");
      setSchedule("");
      setDescription("");
      setShowForm(false);
      await onCreated();
      router.push(groupRoomHref(created.id, membership.regionId));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "모임을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pt-4">
        <button type="button" onClick={onChangeRegion} className="flex items-center gap-1 text-sm font-semibold text-[#1a233a]">
          {regionLabel(membership.sido, membership.district) || "전체"}
          <span className="text-[#9aa3b2]">▾</span>
        </button>
        <div className="flex items-center gap-3 text-[#1a233a]">
          <IconSearch />
          <IconBell />
        </div>
      </header>

      <div className="mt-3 flex border-b border-[#eef1f6] px-4">
        {(
          [
            ["all", "모임"],
            ["mine", "나의 모임"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={`mr-6 pb-2 text-sm ${sub === id ? "border-b-2 border-[#1a233a] font-bold text-[#1a233a]" : "text-[#9aa3b2]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-x-2 gap-y-3 px-3 py-4">
        {GROUP_CATEGORIES.map((item) => {
          const active = cat === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setCat(item.id)} className="flex flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? "ring-2 ring-[#1a233a] ring-offset-1" : ""}`}
                style={{ background: item.color }}
              >
                <CategoryGlyph icon={item.icon} className="h-4 w-4 text-white" />
              </span>
              <span className={`text-[10px] ${active ? "font-semibold text-[#1a233a]" : "text-[#6b7280]"}`}>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-4 pb-2 text-sm">
        <button type="button" onClick={() => setSort("popular")} className={sort === "popular" ? "font-semibold text-[#1a233a]" : "text-[#9aa3b2]"}>
          인기순
        </button>
        <span className="text-[#d1d5db]">|</span>
        <button type="button" onClick={() => setSort("latest")} className={sort === "latest" ? "font-semibold text-[#1a233a]" : "text-[#9aa3b2]"}>
          최신순
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#9aa3b2]">아직 모임이 없습니다</p>
            <p className="mt-1 text-xs text-[#c4c9d4]">아래 + 버튼으로 첫 모임을 만들어 보세요</p>
          </div>
        ) : (
          filtered.map((g) => {
            const meta = groupCategoryMeta(g.category);
            const joined = myGroupIds.has(g.id);
            return (
              <div key={g.id} className="flex gap-3 border-b border-[#f1f3f7] py-3">
                <button
                  type="button"
                  onClick={() => openGroup(g.id)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: meta.color }}
                  aria-label={`${g.title} 모임 열기`}
                >
                  <CategoryGlyph icon={meta.icon} className="h-4 w-4 text-white" />
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => openGroup(g.id)} className="block w-full text-left">
                    <p className="truncate font-semibold text-[#111827]">{g.title}</p>
                    <p className="mt-0.5 text-xs">
                      <span style={{ color: meta.color }}>{meta.label}</span>
                      <span className="text-[#9aa3b2]">
                        {" "}
                        {g.memberCount}/{g.capacity}명
                      </span>
                    </p>
                    <p className="mt-1 truncate text-xs text-[#9aa3b2]">📍 {g.place}</p>
                    <p className="truncate text-xs text-[#9aa3b2]">🕒 {g.schedule}</p>
                  </button>
                  {!joined ? (
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-[#3b82f6]"
                      onClick={() =>
                        void joinGroup(membership.regionId, g, { churchName })
                          .then((next) => {
                            onJoined(next);
                            openGroup(next.id);
                          })
                          .catch((e: Error) => setNotice(e.message))
                      }
                    >
                      참여하고 들어가기
                    </button>
                  ) : (
                    <button type="button" onClick={() => openGroup(g.id)} className="mt-1 text-xs font-medium text-[#3b82f6]">
                      모임방 열기
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        {notice ? <p className="py-2 text-center text-xs text-[#6b7280]">{notice}</p> : null}
      </div>

      {showForm ? (
        <div className="absolute inset-x-3 bottom-20 z-30 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-xl">
          <p className="font-semibold text-[#1a233a]">모임만들기</p>
          <input className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" value={formCat} onChange={(e) => setFormCat(e.target.value as Exclude<GroupCategory, "all">)}>
            {GROUP_CATEGORIES.filter((c) => c.id !== "all").map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <input className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" placeholder="장소" value={place} onChange={(e) => setPlace(e.target.value)} />
          <input className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" placeholder="일정 (예: 매주 토요일 10시)" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
          <textarea
            className="mt-2 min-h-[72px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            placeholder="모임 소개 (선택)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" placeholder="정원" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button type="button" className="flex-1 rounded-lg bg-[#f3f4f6] py-2 text-sm" onClick={() => setShowForm(false)}>
              취소
            </button>
            <button type="button" disabled={busy} className="flex-1 rounded-lg bg-[#1a233a] py-2 text-sm text-white" onClick={() => void submit()}>
              {busy ? "저장 중…" : "만들기"}
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="absolute bottom-[4.75rem] right-4 z-10 flex items-center gap-1.5 rounded-full bg-[#1a233a] px-4 py-3 text-sm font-semibold text-white shadow-lg"
      >
        <IconPencil />
        모임만들기
      </button>
    </div>
  );
}

function BoardTab({
  regionId,
  posts,
  bookmarks,
  profile,
  churchName,
  notice,
  setNotice,
  onPosts,
  onBookmarks,
}: {
  regionId: string;
  posts: CommunityPost[];
  bookmarks: Set<string>;
  profile: CommunityProfile | null;
  churchName: string;
  notice: string;
  setNotice: (v: string) => void;
  onPosts: (p: CommunityPost[]) => void;
  onBookmarks: (b: Set<string>) => void;
}) {
  const [sort, setSort] = useState<SortMode>("popular");
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<BoardCategory>("free");
  const [commentBody, setCommentBody] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => sortPosts(posts, sort), [posts, sort]);

  async function submitPost() {
    setBusy(true);
    setNotice("");
    try {
      const row = await createPost(regionId, title, body, category, {
        churchName: profile?.churchName || churchName,
        authorNick: profile?.nickname,
        verified: profile?.verified,
      });
      onPosts([row, ...posts]);
      setTitle("");
      setBody("");
      setShowForm(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "글을 올리지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function openPost(post: CommunityPost) {
    setOpenId(post.id);
    try {
      await bumpPostView(regionId, post.id, post.views);
      onPosts(posts.map((p) => (p.id === post.id ? { ...p, views: p.views + 1 } : p)));
      setComments(await loadComments(regionId, post.id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "글을 열지 못했습니다.");
    }
  }

  async function submitComment(postId: string) {
    setBusy(true);
    try {
      const row = await createComment(regionId, postId, commentBody, profile?.nickname);
      setComments((prev) => [...prev, row]);
      onPosts(posts.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)));
      setCommentBody("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "댓글을 남기지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-xl font-bold text-[#1a233a]">게시판</h2>
        <div className="flex items-center gap-3 text-[#1a233a]">
          <IconSearch />
          <IconMenu />
        </div>
      </header>

      <div className="mt-3 flex justify-end gap-2 px-4">
        <SortPill active={sort === "latest"} label="최신순" onClick={() => setSort("latest")} />
        <SortPill active={sort === "popular"} label="인기순" onClick={() => setSort("popular")} dark />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-2">
        {sorted.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#9aa3b2]">아직 글이 없습니다</p>
        ) : (
          sorted.map((post) => {
            const key = postBookmarkKey(regionId, post.id);
            const marked = bookmarks.has(key);
            return (
              <article key={post.id} className="border-b border-[#f1f3f7] py-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-md bg-[#e8f1ff] px-2 py-0.5 text-[11px] font-medium text-[#3b82f6]">{categoryLabel(post.category)}</span>
                  <button
                    type="button"
                    className="text-[#9aa3b2]"
                    aria-label="북마크"
                    onClick={() =>
                      void toggleBookmark(regionId, post.id, marked)
                        .then((next) => {
                          const copy = new Set(bookmarks);
                          if (next) copy.add(key);
                          else copy.delete(key);
                          onBookmarks(copy);
                        })
                        .catch((e: Error) => setNotice(e.message))
                    }
                  >
                    <IconBookmark filled={marked} />
                  </button>
                </div>
                <button type="button" className="mt-1 w-full text-left" onClick={() => void openPost(post)}>
                  <h3 className="text-[15px] font-bold text-[#111827]">{post.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#9aa3b2]">
                    <span>{post.authorNick}</span>
                    {post.verified ? <IconVerified /> : null}
                    <span>·</span>
                    <span>{post.churchName || churchName}</span>
                    <span>·</span>
                    <span>{formatCommunityWhen(post.createdAt)}</span>
                  </p>
                  <p className="mt-1.5 flex items-center gap-3 text-xs text-[#9aa3b2]">
                    <span className="inline-flex items-center gap-1">
                      <IconHeart /> {post.likes}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconEye /> {post.views}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconChat className="h-4 w-4" /> {post.commentCount}
                    </span>
                  </p>
                </button>
                {openId === post.id ? (
                  <div className="mt-3 rounded-xl bg-[#f8fafc] p-3">
                    <p className="whitespace-pre-wrap text-sm text-[#374151]">{post.body}</p>
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-[#3b82f6]"
                      onClick={() =>
                        void togglePostLike(regionId, post.id, post.likes, false)
                          .then(({ likes }) => onPosts(posts.map((p) => (p.id === post.id ? { ...p, likes } : p))))
                          .catch((e: Error) => setNotice(e.message))
                      }
                    >
                      좋아요
                    </button>
                    <ul className="mt-2 space-y-1">
                      {comments.map((c) => (
                        <li key={c.id} className="text-xs text-[#4b5563]">
                          <span className="font-medium">{c.authorNick}</span> {c.body}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="flex-1 rounded-lg border border-[#e5e7eb] px-2 py-1.5 text-xs"
                        placeholder="댓글"
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                      />
                      <button type="button" disabled={busy} className="rounded-lg bg-[#1a233a] px-3 text-xs text-white" onClick={() => void submitComment(post.id)}>
                        등록
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
        {notice ? <p className="py-2 text-center text-xs text-[#6b7280]">{notice}</p> : null}
      </div>

      {showForm ? (
        <div className="absolute inset-x-3 bottom-20 z-30 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-xl">
          <p className="font-semibold text-[#1a233a]">글쓰기</p>
          <select className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value as BoardCategory)}>
            {BOARD_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <input className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" rows={4} placeholder="내용" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button type="button" className="flex-1 rounded-lg bg-[#f3f4f6] py-2 text-sm" onClick={() => setShowForm(false)}>
              취소
            </button>
            <button type="button" disabled={busy} className="flex-1 rounded-lg bg-[#1a233a] py-2 text-sm text-white" onClick={() => void submitPost()}>
              {busy ? "올리는 중…" : "올리기"}
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="absolute bottom-[4.75rem] right-4 z-10 flex items-center gap-1.5 rounded-full bg-[#1a233a] px-4 py-3 text-sm font-semibold text-white shadow-lg"
      >
        <IconPencil />
        글쓰기
      </button>
    </div>
  );
}

function SortPill({ active, label, onClick, dark }: { active: boolean; label: string; onClick: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
        active ? (dark ? "bg-[#1a233a] text-white" : "bg-[#eef1f6] text-[#1a233a]") : "bg-[#f3f4f6] text-[#9aa3b2]"
      }`}
    >
      {label}
    </button>
  );
}

function MyChurchTab({
  churchName,
  churchId,
  regionLabel: region,
  notices,
  schedule,
  notice,
  setNotice,
  onNotices,
  onSchedule,
}: {
  churchName: string;
  churchId: string;
  regionLabel: string;
  notices: ChurchNotice[];
  schedule: ChurchScheduleItem[];
  notice: string;
  setNotice: (v: string) => void;
  onNotices: (n: ChurchNotice[]) => void;
  onSchedule: (s: ChurchScheduleItem[]) => void;
}) {
  const [sub, setSub] = useState<"notices" | "schedule">("notices");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("");
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setNotice("");
    try {
      if (sub === "notices") {
        const row = await createChurchNotice(churchId, title, body);
        onNotices([row, ...notices]);
      } else {
        const row = await createChurchSchedule(churchId, title, when, place);
        onSchedule([row, ...schedule]);
      }
      setTitle("");
      setBody("");
      setWhen("");
      setPlace("");
      setShowForm(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const empty = sub === "notices" ? notices.length === 0 : schedule.length === 0;

  return (
    <div className="relative flex flex-1 flex-col">
      <header className="px-4 pt-4">
        <h2 className="text-lg font-bold text-[#1a233a]">{churchName}</h2>
        <p className="mt-0.5 text-xs text-[#9aa3b2]">{region}</p>
      </header>

      <div className="mt-3 flex items-center justify-between border-b border-[#eef1f6] px-4">
        <div className="flex">
          <button
            type="button"
            onClick={() => setSub("notices")}
            className={`mr-6 pb-2 text-sm ${sub === "notices" ? "border-b-2 border-[#1a233a] font-bold text-[#1a233a]" : "text-[#9aa3b2]"}`}
          >
            공지
          </button>
          <button
            type="button"
            onClick={() => setSub("schedule")}
            className={`pb-2 text-sm ${sub === "schedule" ? "border-b-2 border-[#1a233a] font-bold text-[#1a233a]" : "text-[#9aa3b2]"}`}
          >
            일정
          </button>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="pb-2 text-sm font-medium text-[#3b82f6]">
          + 작성
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-6">
        {empty ? (
          <div className="flex flex-col items-center py-16 text-[#c4c9d4]">
            <IconMegaphone className="h-8 w-8" />
            <p className="mt-3 text-sm text-[#9aa3b2]">{sub === "notices" ? "아직 공지사항이 없습니다" : "아직 일정이 없습니다"}</p>
            <p className="mt-1 text-xs text-[#c4c9d4]">오른쪽 위 작성으로 첫 글을 남겨 보세요</p>
          </div>
        ) : sub === "notices" ? (
          notices.map((n) => (
            <div key={n.id} className="border-b border-[#f1f3f7] py-3">
              <p className="font-semibold text-[#111827]">{n.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#6b7280]">{n.body}</p>
              <p className="mt-1 text-xs text-[#9aa3b2]">{formatCommunityWhen(n.createdAt)}</p>
            </div>
          ))
        ) : (
          schedule.map((s) => (
            <div key={s.id} className="border-b border-[#f1f3f7] py-3">
              <p className="font-semibold text-[#111827]">{s.title}</p>
              <p className="mt-1 text-sm text-[#6b7280]">
                {s.when} · {s.place}
              </p>
            </div>
          ))
        )}
        {notice ? <p className="py-2 text-center text-xs text-[#6b7280]">{notice}</p> : null}
      </div>

      {showForm ? (
        <div className="absolute inset-x-3 bottom-20 z-30 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-xl">
          <p className="font-semibold text-[#1a233a]">{sub === "notices" ? "공지 작성" : "일정 작성"}</p>
          <input className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
          {sub === "notices" ? (
            <textarea className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" rows={3} placeholder="내용" value={body} onChange={(e) => setBody(e.target.value)} />
          ) : (
            <>
              <input className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" placeholder="언제" value={when} onChange={(e) => setWhen(e.target.value)} />
              <input className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" placeholder="장소" value={place} onChange={(e) => setPlace(e.target.value)} />
            </>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" className="flex-1 rounded-lg bg-[#f3f4f6] py-2 text-sm" onClick={() => setShowForm(false)}>
              취소
            </button>
            <button type="button" disabled={busy} className="flex-1 rounded-lg bg-[#1a233a] py-2 text-sm text-white" onClick={() => void submit()}>
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChatTab({
  chats,
  notice,
  setNotice,
  onChats,
}: {
  chats: ChatThread[];
  notice: string;
  setNotice: (v: string) => void;
  onChats: (c: ChatThread[]) => void;
}) {
  const [sub, setSub] = useState<"unread" | "personal" | "group">("unread");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (sub === "unread") return chats.filter((c) => c.unread);
    if (sub === "personal") return chats.filter((c) => c.kind === "personal");
    return chats.filter((c) => c.kind === "group");
  }, [chats, sub]);

  async function createStub() {
    setBusy(true);
    setNotice("");
    try {
      const row = await createChatShell(sub === "group" ? "모임 채팅" : "새 대화", sub === "group" ? "group" : "personal");
      onChats([row, ...chats]);
      setNotice("채팅방 껍데기를 만들었습니다. 실시간 메시지는 준비 중입니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "채팅을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-xl font-bold text-[#1a233a]">채팅</h2>
        <IconBell className="text-[#1a233a]" />
      </header>
      <div className="mt-3 flex border-b border-[#eef1f6] px-4">
        {(
          [
            ["unread", "안읽음"],
            ["personal", "개인"],
            ["group", "모임"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={`flex-1 pb-2 text-center text-sm ${sub === id ? "border-b-2 border-[#1a233a] font-bold text-[#1a233a]" : "text-[#9aa3b2]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        {filtered.length === 0 ? (
          <>
            <IconBell className="h-8 w-8 text-[#d1d5db]" />
            <p className="mt-4 text-sm font-semibold text-[#9aa3b2]">
              {sub === "unread" ? "안읽음 채팅이 없습니다" : sub === "personal" ? "개인 채팅이 없습니다" : "모임 채팅이 없습니다"}
            </p>
            <p className="mt-1 text-xs text-[#c4c9d4]">{sub === "unread" ? "모든 채팅을 확인했어요" : "아래에서 채팅방 껍데기를 만들 수 있어요"}</p>
            {sub !== "unread" ? (
              <button type="button" disabled={busy} onClick={() => void createStub()} className="mt-6 rounded-full bg-[#1a233a] px-4 py-2 text-xs font-semibold text-white">
                {busy ? "만드는 중…" : "채팅방 만들기 (MVP)"}
              </button>
            ) : null}
          </>
        ) : (
          <ul className="w-full space-y-2 self-stretch">
            {filtered.map((c) => (
              <li key={c.id} className="rounded-xl border border-[#eef1f6] px-3 py-3 text-sm">
                <p className="font-semibold text-[#1a233a]">{c.title}</p>
                <p className="text-xs text-[#9aa3b2]">{c.kind === "group" ? "모임" : "개인"} · 메시지 기능 준비 중</p>
              </li>
            ))}
          </ul>
        )}
        {notice ? <p className="mt-4 text-center text-xs text-[#6b7280]">{notice}</p> : null}
      </div>
    </div>
  );
}

function MyTab({
  profile,
  churchName,
  email,
  userId,
  posts,
  bookmarks,
  regionId,
  notice,
  setNotice,
  onProfile,
}: {
  profile: CommunityProfile | null;
  churchName: string;
  email: string;
  userId: string;
  posts: CommunityPost[];
  bookmarks: Set<string>;
  regionId: string;
  notice: string;
  setNotice: (v: string) => void;
  onProfile: (p: CommunityProfile | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState(profile?.nickname || nicknameFromEmail(email));
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<"none" | "posts" | "bookmarks">("none");

  useEffect(() => {
    setNick(profile?.nickname || nicknameFromEmail(email));
  }, [profile?.nickname, email]);

  const myPosts = posts.filter((p) => p.authorUid && userId && p.authorUid === userId);
  const bookmarkedPosts = posts.filter((p) => bookmarks.has(postBookmarkKey(regionId, p.id)));

  async function saveNick() {
    setBusy(true);
    setNotice("");
    try {
      const row = await saveProfile({
        nickname: nick,
        churchName: profile?.churchName || churchName,
        verificationStatus: profile?.verificationStatus || "none",
      });
      onProfile(row);
      setEditing(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadVerify() {
    setBusy(true);
    setNotice("");
    try {
      const row = await requestMemberVerification(churchName);
      onProfile(row);
      setNotice("교인 인증 요청을 보냈습니다. (주보 사진 업로드는 검토용으로 표시됩니다)");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "인증 요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const displayName = profile?.nickname || nicknameFromEmail(email);
  const status = profile?.verificationStatus || "none";

  return (
    <div className="flex flex-1 flex-col overflow-y-auto pb-8">
      <header className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-xl font-bold text-[#1a233a]">마이페이지</h2>
        <IconBell className="text-[#1a233a]" />
      </header>

      <div className="mt-5 flex items-center gap-3 px-4">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef1f6] text-[#9aa3b2]">
          <IconMy className="h-8 w-8" />
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#1a233a] text-white">
            <IconPencil className="h-3 w-3" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-lg font-bold text-[#111827]">
            {displayName}
            {profile?.verified ? <IconVerified className="h-4 w-4" /> : null}
          </p>
          <p className="text-sm text-[#9aa3b2]">{profile?.churchName || churchName}</p>
        </div>
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb]" onClick={() => setEditing((v) => !v)} aria-label="수정">
          <IconPencil className="text-[#1a233a]" />
        </button>
      </div>

      {editing ? (
        <div className="mx-4 mt-3 rounded-xl border border-[#e5e7eb] p-3">
          <input className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="닉네임" />
          <button type="button" disabled={busy} onClick={() => void saveNick()} className="mt-2 w-full rounded-lg bg-[#1a233a] py-2 text-sm text-white">
            저장
          </button>
        </div>
      ) : null}

      <button type="button" onClick={() => setEditing(true)} className="mx-4 mt-5 flex items-center gap-3 border-b border-[#f1f3f7] py-3 text-left">
        <IconMy className="h-5 w-5 text-[#1a233a]" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#1a233a]">내 정보 수정</span>
          <span className="block text-xs text-[#9aa3b2]">커뮤니티 닉네임, 모임 프로필</span>
        </span>
        <span className="text-[#c4c9d4]">›</span>
      </button>

      <div className="px-4 pt-5">
        <p className="text-sm font-bold text-[#1a233a]">교인 인증</p>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-[#f3f4f6] px-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#4b5563]">주보 사진을 업로드하여 교인임을 인증하세요</p>
            <p className="mt-0.5 text-[11px] text-[#9aa3b2]">
              {status === "pending"
                ? "인증 검토 중입니다"
                : status === "verified"
                  ? "인증이 완료되었습니다"
                  : "인증 완료 시 닉네임 옆에 배지가 표시됩니다"}
            </p>
          </div>
          {status !== "verified" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void uploadVerify()}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-[#1a233a] px-3 py-2 text-xs font-semibold text-white"
            >
              <IconUpload />
              업로드
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 px-4">
        <p className="text-xs font-medium text-[#9aa3b2]">내 활동</p>
        <button type="button" className="mt-2 flex w-full items-center gap-3 py-3 text-left" onClick={() => setActivity(activity === "posts" ? "none" : "posts")}>
          <IconBoard className="h-5 w-5 text-[#1a233a]" />
          <span className="flex-1 text-sm text-[#1a233a]">내가 쓴 게시글</span>
          <span className="text-[#c4c9d4]">›</span>
        </button>
        <button type="button" className="flex w-full items-center gap-3 border-t border-[#f1f3f7] py-3 text-left" onClick={() => setActivity("none")}>
          <IconChat className="h-5 w-5 text-[#1a233a]" />
          <span className="flex-1 text-sm text-[#1a233a]">내가 쓴 댓글</span>
          <span className="text-[#c4c9d4]">›</span>
        </button>
        <button type="button" className="flex w-full items-center gap-3 border-t border-[#f1f3f7] py-3 text-left" onClick={() => setActivity(activity === "bookmarks" ? "none" : "bookmarks")}>
          <IconBookmark className="h-5 w-5 text-[#1a233a]" />
          <span className="flex-1 text-sm text-[#1a233a]">북마크한 게시글</span>
          <span className="text-[#c4c9d4]">›</span>
        </button>
        <button type="button" className="mt-1 flex w-full items-center gap-3 border-t border-[#e5e7eb] py-3 text-left">
          <IconMegaphone className="h-5 w-5 text-[#1a233a]" />
          <span className="flex-1 text-sm text-[#1a233a]">공지사항</span>
          <span className="text-[#c4c9d4]">›</span>
        </button>
      </div>

      {activity === "posts" ? (
        <ul className="mx-4 mt-2 space-y-1 rounded-xl bg-[#f8fafc] p-3 text-sm">
          {myPosts.length === 0 ? <li className="text-[#9aa3b2]">작성한 글이 없습니다</li> : myPosts.map((p) => <li key={p.id}>{p.title}</li>)}
        </ul>
      ) : null}
      {activity === "bookmarks" ? (
        <ul className="mx-4 mt-2 space-y-1 rounded-xl bg-[#f8fafc] p-3 text-sm">
          {bookmarkedPosts.length === 0 ? (
            <li className="text-[#9aa3b2]">북마크한 글이 없습니다</li>
          ) : (
            bookmarkedPosts.map((p) => <li key={p.id}>{p.title}</li>)
          )}
        </ul>
      ) : null}

      {notice ? <p className="px-4 pt-3 text-center text-xs text-[#6b7280]">{notice}</p> : null}
    </div>
  );
}
