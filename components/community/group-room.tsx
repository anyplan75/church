"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useChurch } from "@/components/church-state";
import {
  GROUP_ROOM_TABS,
  formatCommunityWhen,
  groupCategoryMeta,
  nicknameFromEmail,
  type CommunityGroup,
  type CommunityProfile,
  type GroupAlbumItem,
  type GroupMember,
  type GroupPost,
  type GroupRoomTab,
  type GroupScheduleItem,
} from "@/lib/community";
import {
  createGroupAlbumItem,
  createGroupPost,
  createGroupSchedule,
  deleteGroupSchedule,
  joinGroup,
  loadGroup,
  loadGroupAlbum,
  loadGroupMembers,
  loadGroupPosts,
  loadGroupSchedule,
  loadMembership,
  loadProfile,
} from "@/lib/community-db";
import { canUseCommunity } from "@/lib/community-access";
import { CategoryGlyph, IconPencil, IconPeople } from "./community-icons";

type Props = {
  groupId: string;
  regionId: string;
};

export function GroupRoom({ groupId, regionId }: Props) {
  const { db, user, ready } = useChurch();
  const churchName = db?.settings.churchName || "내 교회";

  const [tab, setTab] = useState<GroupRoomTab>("home");
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [schedule, setSchedule] = useState<GroupScheduleItem[]>([]);
  const [album, setAlbum] = useState<GroupAlbumItem[]>([]);
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolvedRegion, setResolvedRegion] = useState(regionId);

  const refresh = useCallback(async (rid: string, gid: string) => {
    const row = await loadGroup(rid, gid);
    setGroup(row);
    if (!row) {
      setMembers([]);
      setPosts([]);
      setSchedule([]);
      setAlbum([]);
      return;
    }
    const [m, p, s, a, prof] = await Promise.all([
      loadGroupMembers(rid, gid, row.authorUid),
      loadGroupPosts(rid, gid),
      loadGroupSchedule(rid, gid),
      loadGroupAlbum(rid, gid),
      loadProfile(),
    ]);
    setMembers(m);
    setPosts(p);
    setSchedule(s);
    setAlbum(a);
    setProfile(prof);
  }, []);

  useEffect(() => {
    if (!ready || !canUseCommunity(user)) return;
    let cancel = false;
    void (async () => {
      try {
        let rid = regionId;
        if (!rid) {
          const membership = await loadMembership();
          rid = membership?.regionId || "";
        }
        if (cancel) return;
        setResolvedRegion(rid);
        if (!rid || !groupId) {
          setNotice("모임 정보가 없습니다. 커뮤니티에서 다시 열어 주세요.");
          return;
        }
        await refresh(rid, groupId);
      } catch (error) {
        if (!cancel) setNotice(error instanceof Error ? error.message : "모임을 불러오지 못했습니다.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [ready, user, regionId, groupId, refresh]);

  if (!ready) return null;

  if (!canUseCommunity(user)) {
    return (
      <div className="rounded-2xl border border-line bg-card px-5 py-6">
        <h1 className="font-serif text-2xl">모임</h1>
        <p className="mt-2 text-sm text-muted">교회를 연 뒤에 모임을 이용해 주세요.</p>
        <Link href="/community/" className="mt-4 inline-block text-sm font-medium text-[#3b82f6]">
          커뮤니티로 돌아가기
        </Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="rounded-2xl border border-[#e8ecf2] bg-white px-5 py-10 text-center shadow-sm">
        <p className="text-sm text-[#6b7280]">{notice || "모임을 불러오는 중…"}</p>
        <Link href="/community/" className="mt-4 inline-block text-sm font-medium text-[#3b82f6]">
          커뮤니티로 돌아가기
        </Link>
      </div>
    );
  }

  const meta = groupCategoryMeta(group.category);
  const isMember = Boolean(user && members.some((m) => m.uid === user.id));
  const nick = profile?.nickname || nicknameFromEmail(user?.email || "");

  async function handleJoin() {
    if (!group || !resolvedRegion) return;
    setBusy(true);
    setNotice("");
    try {
      const next = await joinGroup(resolvedRegion, group, { nickname: nick, churchName });
      setGroup(next);
      await refresh(resolvedRegion, group.id);
      setNotice("모임에 참여했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "참여하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-[#e8ecf2] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a233a] via-[#243352] to-[#3d4f73] px-5 pb-5 pt-4 text-white sm:px-8 sm:pt-6">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-48 rounded-full bg-[#60a5fa]/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <Link href="/community/" className="text-sm text-white/80 hover:text-white">
            ← 모임 목록
          </Link>
          {!isMember ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleJoin()}
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[#1a233a] disabled:opacity-60"
            >
              {busy ? "참여 중…" : "참여하기"}
            </button>
          ) : (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs text-white/90">참여 중</span>
          )}
        </div>
        <div className="relative mt-5 flex items-end gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-lg sm:h-20 sm:w-20"
            style={{ background: meta.color }}
          >
            <CategoryGlyph icon={meta.icon} className="h-8 w-8 text-white sm:h-9 sm:w-9" />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-xs font-medium text-white/70">{meta.label}</p>
            <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight sm:text-3xl">{group.title}</h1>
            <p className="mt-1 text-sm text-white/75">
              {group.memberCount}/{group.capacity}명 · {group.place} · {group.schedule}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[#eef1f6] px-2 sm:px-4">
        {GROUP_ROOM_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 px-3 py-3 text-sm sm:px-4 ${
              tab === item.id ? "border-b-2 border-[#1a233a] font-bold text-[#1a233a]" : "text-[#9aa3b2]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-[420px] px-4 py-5 sm:px-8 sm:py-6">
        {tab === "home" ? (
          <HomePane group={group} members={members} posts={posts} schedule={schedule} />
        ) : null}
        {tab === "board" ? (
          <BoardPane
            posts={posts}
            canWrite={isMember}
            nick={nick}
            onCreate={async (title, body) => {
              const row = await createGroupPost(resolvedRegion, group.id, title, body, nick);
              setPosts((prev) => [row, ...prev]);
            }}
            setNotice={setNotice}
          />
        ) : null}
        {tab === "schedule" ? (
          <SchedulePane
            items={schedule}
            canWrite={isMember}
            userId={user?.id || ""}
            onCreate={async (title, when, place) => {
              const row = await createGroupSchedule(resolvedRegion, group.id, title, when, place, nick);
              setSchedule((prev) => [row, ...prev]);
            }}
            onDelete={async (id) => {
              await deleteGroupSchedule(resolvedRegion, group.id, id);
              setSchedule((prev) => prev.filter((x) => x.id !== id));
            }}
            setNotice={setNotice}
          />
        ) : null}
        {tab === "album" ? (
          <AlbumPane
            items={album}
            canWrite={isMember}
            onCreate={async (title, url, note) => {
              const row = await createGroupAlbumItem(resolvedRegion, group.id, title, url, note, nick);
              setAlbum((prev) => [row, ...prev]);
            }}
            setNotice={setNotice}
          />
        ) : null}
        {tab === "chat" ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[#6b7280]">채팅은 준비 중입니다.</p>
            <p className="mt-1 text-xs text-[#9aa3b2]">지금은 게시판과 일정으로 소식을 나눠 주세요.</p>
          </div>
        ) : null}
        {notice ? <p className="mt-4 text-center text-xs text-[#6b7280]">{notice}</p> : null}
      </div>
    </div>
  );
}

function HomePane({
  group,
  members,
  posts,
  schedule,
}: {
  group: CommunityGroup;
  members: GroupMember[];
  posts: GroupPost[];
  schedule: GroupScheduleItem[];
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-bold text-[#1a233a]">모임 소개</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4b5563]">
          {group.description || "아직 소개글이 없습니다. 게시판에서 첫 글을 남겨 보세요."}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-[#f7f8fb] px-3 py-2">
            <dt className="text-xs text-[#9aa3b2]">장소</dt>
            <dd className="mt-0.5 font-medium text-[#1a233a]">{group.place}</dd>
          </div>
          <div className="rounded-xl bg-[#f7f8fb] px-3 py-2">
            <dt className="text-xs text-[#9aa3b2]">정기 일정</dt>
            <dd className="mt-0.5 font-medium text-[#1a233a]">{group.schedule}</dd>
          </div>
          <div className="rounded-xl bg-[#f7f8fb] px-3 py-2">
            <dt className="text-xs text-[#9aa3b2]">정원</dt>
            <dd className="mt-0.5 font-medium text-[#1a233a]">
              {group.memberCount}/{group.capacity}명
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#1a233a]">
            <IconPeople className="h-4 w-4" />
            멤버 {members.length}
          </h2>
        </div>
        <ul className="mt-3 divide-y divide-[#f1f3f7]">
          {members.length === 0 ? (
            <li className="py-6 text-center text-sm text-[#9aa3b2]">아직 멤버가 없습니다</li>
          ) : (
            members.map((m) => (
              <li key={m.uid} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2ff] text-xs font-semibold text-[#4338ca]">
                  {(m.nickname || "?").slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#111827]">
                    {m.nickname}
                    {m.isOwner ? <span className="ml-1.5 text-xs font-normal text-[#f59e0b]">모임장</span> : null}
                  </p>
                  <p className="truncate text-xs text-[#9aa3b2]">{m.churchName || "교회"}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {schedule[0] ? (
        <section>
          <h2 className="text-sm font-bold text-[#1a233a]">다가오는 일정</h2>
          <div className="mt-2 rounded-xl border border-[#eef1f6] px-4 py-3">
            <p className="font-medium text-[#111827]">{schedule[0].title}</p>
            <p className="mt-1 text-xs text-[#6b7280]">
              {schedule[0].when} · {schedule[0].place}
            </p>
          </div>
        </section>
      ) : null}

      {posts[0] ? (
        <section>
          <h2 className="text-sm font-bold text-[#1a233a]">최근 게시글</h2>
          <div className="mt-2 rounded-xl border border-[#eef1f6] px-4 py-3">
            <p className="font-medium text-[#111827]">{posts[0].title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-[#6b7280]">{posts[0].body}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BoardPane({
  posts,
  canWrite,
  nick,
  onCreate,
  setNotice,
}: {
  posts: GroupPost[];
  canWrite: boolean;
  nick: string;
  onCreate: (title: string, body: string) => Promise<void>;
  setNotice: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setNotice("");
    try {
      await onCreate(title, body);
      setTitle("");
      setBody("");
      setOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "글을 올리지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative pb-16">
      {posts.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#9aa3b2]">아직 게시글이 없습니다</p>
      ) : (
        <ul className="divide-y divide-[#f1f3f7]">
          {posts.map((p) => (
            <li key={p.id} className="py-4">
              <p className="font-semibold text-[#111827]">{p.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#4b5563]">{p.body}</p>
              <p className="mt-2 text-xs text-[#9aa3b2]">
                {p.authorNick || nick} · {formatCommunityWhen(p.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-4xl border-t border-[#e5e7eb] bg-white p-4 shadow-2xl sm:relative sm:mt-4 sm:rounded-2xl sm:border sm:shadow-lg">
          <p className="font-semibold text-[#1a233a]">글쓰기</p>
          <input
            className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            placeholder="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="mt-2 min-h-[100px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            placeholder="내용"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <button type="button" className="flex-1 rounded-lg bg-[#f3f4f6] py-2 text-sm" onClick={() => setOpen(false)}>
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              className="flex-1 rounded-lg bg-[#1a233a] py-2 text-sm text-white disabled:opacity-60"
              onClick={() => void submit()}
            >
              {busy ? "올리는 중…" : "올리기"}
            </button>
          </div>
        </div>
      ) : null}

      {canWrite && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-0 right-0 flex items-center gap-1.5 rounded-full bg-[#1a233a] px-4 py-3 text-sm font-semibold text-white shadow-lg"
        >
          <IconPencil />
          글쓰기
        </button>
      ) : null}
      {!canWrite ? <p className="mt-4 text-center text-xs text-[#9aa3b2]">글을 쓰려면 먼저 모임에 참여해 주세요.</p> : null}
    </div>
  );
}

function SchedulePane({
  items,
  canWrite,
  userId,
  onCreate,
  onDelete,
  setNotice,
}: {
  items: GroupScheduleItem[];
  canWrite: boolean;
  userId: string;
  onCreate: (title: string, when: string, place: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  setNotice: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setNotice("");
    try {
      await onCreate(title, when, place);
      setTitle("");
      setWhen("");
      setPlace("");
      setOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "일정을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#1a233a]">모임 일정</h2>
        {canWrite ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-medium text-[#3b82f6]">
            {open ? "닫기" : "+ 일정 추가"}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 rounded-xl border border-[#e5e7eb] p-3">
          <input
            className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            placeholder="일정 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            placeholder="언제 (예: 4월 20일 오후 2시)"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            placeholder="어디서"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="mt-3 w-full rounded-lg bg-[#1a233a] py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? "저장 중…" : "일정 만들기"}
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#9aa3b2]">등록된 일정이 없습니다</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-[#eef1f6] px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#111827]">{item.title}</p>
                  <p className="mt-1 text-sm text-[#4b5563]">{item.when}</p>
                  <p className="text-xs text-[#9aa3b2]">{item.place} · {item.authorNick}</p>
                </div>
                {canWrite && item.authorUid === userId ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-[#ef4444]"
                    onClick={() =>
                      void onDelete(item.id).catch((e: Error) => setNotice(e.message || "삭제하지 못했습니다."))
                    }
                  >
                    삭제
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!canWrite ? <p className="mt-4 text-center text-xs text-[#9aa3b2]">일정을 만들려면 먼저 모임에 참여해 주세요.</p> : null}
    </div>
  );
}

function AlbumPane({
  items,
  canWrite,
  onCreate,
  setNotice,
}: {
  items: GroupAlbumItem[];
  canWrite: boolean;
  onCreate: (title: string, url: string, note: string) => Promise<void>;
  setNotice: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setNotice("");
    try {
      await onCreate(title, url, note);
      setTitle("");
      setUrl("");
      setNote("");
      setOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "자료를 올리지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#1a233a]">앨범 · 자료</h2>
        {canWrite ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-medium text-[#3b82f6]">
            {open ? "닫기" : "+ 링크 추가"}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-[#9aa3b2]">사진 업로드는 이후 단계에서, 지금은 자료 링크로 공유합니다.</p>

      {open ? (
        <div className="mt-3 rounded-xl border border-[#e5e7eb] p-3">
          <input
            className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            placeholder="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            placeholder="메모 (선택)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="mt-3 w-full rounded-lg bg-[#1a233a] py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? "저장 중…" : "추가"}
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#9aa3b2]">아직 자료가 없습니다</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-[#eef1f6] px-4 py-3">
              <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-[#3b82f6] hover:underline">
                {item.title}
              </a>
              {item.note ? <p className="mt-1 text-sm text-[#6b7280]">{item.note}</p> : null}
              <p className="mt-1 text-xs text-[#9aa3b2]">
                {item.authorNick} · {formatCommunityWhen(item.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
