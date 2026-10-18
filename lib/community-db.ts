import { authToken, currentUser } from "./app-db";
import { canUseCommunity } from "./community-access";
import {
  bookmarkKeysFromMap,
  chatsFromMap,
  cleanCommentBody,
  cleanDistrict,
  cleanGroupTitle,
  cleanNickname,
  cleanPostBody,
  cleanPostTitle,
  cleanResourceNote,
  cleanResourceTitle,
  cleanResourceUrl,
  cleanShort,
  commentsFromMap,
  groupAlbumFromMap,
  groupFromRaw,
  groupPostsFromMap,
  groupScheduleFromMap,
  groupsFromMap,
  isBoardCategory,
  isCommunitySido,
  isGroupCategory,
  membersFromMap,
  membershipFromRaw,
  newCommunityId,
  nicknameFromEmail,
  noticesFromMap,
  postBookmarkKey,
  postsFromMap,
  profileFromRaw,
  regionIdFrom,
  regionLabel,
  resourcesFromMap,
  scheduleFromMap,
  type BoardCategory,
  type ChatThread,
  type ChurchNotice,
  type ChurchScheduleItem,
  type CommunityComment,
  type CommunityGroup,
  type CommunityMembership,
  type CommunityPost,
  type CommunityProfile,
  type CommunityResource,
  type GroupAlbumItem,
  type GroupMember,
  type GroupPost,
  type GroupScheduleItem,
  type PostCategory,
} from "./community";
import { DatabasePermissionError, dbGet, dbPatch, dbSet } from "./firebase-db";

function requireCommunityUser() {
  const user = currentUser();
  // 교회 계정, 또는 교회를 연 전체 운영자(platform + churchId)만 커뮤니티를 씁니다.
  if (!canUseCommunity(user)) {
    throw new Error("교회를 연 뒤에 커뮤니티를 이용해 주세요.");
  }
  return user!;
}

function rethrowCommunity(error: unknown): never {
  if (error instanceof DatabasePermissionError) {
    throw new Error("커뮤니티 권한이 없습니다. 교회 계정으로 다시 로그인해 주세요.");
  }
  throw error;
}

function churchNameOf(user: { churchId: string | null }, fallback = ""): string {
  return cleanShort(fallback, 40);
}

export async function loadMembership(): Promise<CommunityMembership | null> {
  const user = requireCommunityUser();
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/memberships/${user.id}`, token);
    return membershipFromRaw(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function saveMembership(sido: string, district = ""): Promise<CommunityMembership> {
  const user = requireCommunityUser();
  if (!isCommunitySido(sido.trim())) throw new Error("시·도를 골라 주세요.");
  const clean = cleanDistrict(district);
  const regionId = regionIdFrom(sido, clean);
  if (!regionId) throw new Error("지역을 다시 확인해 주세요.");
  const row: CommunityMembership = {
    regionId,
    sido: sido.trim(),
    district: clean,
    churchId: user.churchId!,
    updatedAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/regions/${regionId}`, { name: regionLabel(row.sido, row.district), sido: row.sido, district: row.district }, token);
    await dbSet(`community/memberships/${user.id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadProfile(): Promise<CommunityProfile | null> {
  const user = requireCommunityUser();
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/profiles/${user.id}`, token);
    return profileFromRaw(raw, user.id);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function saveProfile(input: {
  nickname: string;
  churchName: string;
  verificationStatus?: CommunityProfile["verificationStatus"];
}): Promise<CommunityProfile> {
  const user = requireCommunityUser();
  const nick = cleanNickname(input.nickname) || nicknameFromEmail(user.email);
  const status = input.verificationStatus ?? "none";
  const row: CommunityProfile = {
    uid: user.id,
    nickname: nick,
    churchId: user.churchId!,
    churchName: cleanShort(input.churchName, 40),
    verified: status === "verified",
    verificationStatus: status,
    updatedAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/profiles/${user.id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function requestMemberVerification(churchName: string): Promise<CommunityProfile> {
  const existing = await loadProfile();
  return saveProfile({
    nickname: existing?.nickname || nicknameFromEmail(requireCommunityUser().email),
    churchName: churchName || existing?.churchName || "",
    verificationStatus: "pending",
  });
}

export async function loadPosts(regionId: string): Promise<CommunityPost[]> {
  requireCommunityUser();
  if (!regionId) return [];
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/posts/${regionId}`, token);
    return postsFromMap(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function createPost(
  regionId: string,
  title: string,
  body: string,
  category: BoardCategory | PostCategory,
  meta?: { churchName?: string; authorNick?: string; verified?: boolean },
): Promise<CommunityPost> {
  const user = requireCommunityUser();
  if (!regionId) throw new Error("지역을 먼저 정해 주세요.");
  const normalized: BoardCategory | null = isBoardCategory(category)
    ? category
    : category === "question"
      ? "qna"
      : category === "share"
        ? "free"
        : null;
  if (!normalized) throw new Error("글 종류를 골라 주세요.");
  const cleanTitle = cleanPostTitle(title);
  const cleanBody = cleanPostBody(body);
  if (!cleanTitle) throw new Error("제목을 입력해 주세요.");
  if (!cleanBody) throw new Error("내용을 입력해 주세요.");
  const id = newCommunityId("post");
  const row: CommunityPost = {
    id,
    title: cleanTitle,
    body: cleanBody,
    category: normalized,
    authorUid: user.id,
    authorEmail: user.email,
    authorNick: cleanNickname(meta?.authorNick || "") || nicknameFromEmail(user.email),
    churchId: user.churchId!,
    churchName: churchNameOf(user, meta?.churchName || ""),
    verified: Boolean(meta?.verified),
    likes: 0,
    views: 0,
    commentCount: 0,
    createdAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/posts/${regionId}/${id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function bumpPostView(regionId: string, postId: string, currentViews: number): Promise<void> {
  requireCommunityUser();
  if (!regionId || !postId) return;
  try {
    const token = await authToken();
    await dbPatch(`community/posts/${regionId}/${postId}`, { views: Math.max(0, currentViews) + 1 }, token);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function togglePostLike(
  regionId: string,
  postId: string,
  currentLikes: number,
  liked: boolean,
): Promise<{ likes: number; liked: boolean }> {
  const user = requireCommunityUser();
  if (!regionId || !postId) throw new Error("글을 다시 열어 주세요.");
  const nextLiked = !liked;
  const likes = Math.max(0, currentLikes + (nextLiked ? 1 : -1));
  try {
    const token = await authToken();
    await dbSet(`community/posts/${regionId}/${postId}/likedBy/${user.id}`, nextLiked ? true : null, token);
    await dbPatch(`community/posts/${regionId}/${postId}`, { likes }, token);
    return { likes, liked: nextLiked };
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadLiked(regionId: string, postId: string): Promise<boolean> {
  const user = requireCommunityUser();
  if (!regionId || !postId) return false;
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/posts/${regionId}/${postId}/likedBy/${user.id}`, token);
    return Boolean(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadBookmarks(): Promise<Set<string>> {
  const user = requireCommunityUser();
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/bookmarks/${user.id}`, token);
    return new Set(bookmarkKeysFromMap(raw));
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function toggleBookmark(regionId: string, postId: string, bookmarked: boolean): Promise<boolean> {
  const user = requireCommunityUser();
  if (!regionId || !postId) throw new Error("글을 다시 열어 주세요.");
  const key = postBookmarkKey(regionId, postId);
  const next = !bookmarked;
  try {
    const token = await authToken();
    await dbSet(
      `community/bookmarks/${user.id}/${key}`,
      next ? { regionId, postId, createdAt: Date.now() } : null,
      token,
    );
    return next;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadComments(regionId: string, postId: string): Promise<CommunityComment[]> {
  requireCommunityUser();
  if (!regionId || !postId) return [];
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/posts/${regionId}/${postId}/comments`, token);
    return commentsFromMap(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function createComment(
  regionId: string,
  postId: string,
  body: string,
  authorNick?: string,
): Promise<CommunityComment> {
  const user = requireCommunityUser();
  if (!regionId || !postId) throw new Error("글을 다시 열어 주세요.");
  const cleanBody = cleanCommentBody(body);
  if (!cleanBody) throw new Error("댓글을 입력해 주세요.");
  const id = newCommunityId("cmt");
  const row: CommunityComment = {
    id,
    body: cleanBody,
    authorUid: user.id,
    authorEmail: user.email,
    authorNick: cleanNickname(authorNick || "") || nicknameFromEmail(user.email),
    createdAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/posts/${regionId}/${postId}/comments/${id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadResources(regionId: string): Promise<CommunityResource[]> {
  requireCommunityUser();
  if (!regionId) return [];
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/resources/${regionId}`, token);
    return resourcesFromMap(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function createResource(regionId: string, title: string, url: string, note = ""): Promise<CommunityResource> {
  const user = requireCommunityUser();
  if (!regionId) throw new Error("지역을 먼저 정해 주세요.");
  const cleanTitle = cleanResourceTitle(title);
  const cleanUrl = cleanResourceUrl(url);
  if (!cleanTitle) throw new Error("자료 이름을 입력해 주세요.");
  if (!cleanUrl) throw new Error("https:// 로 시작하는 링크를 입력해 주세요.");
  const id = newCommunityId("res");
  const row: CommunityResource = {
    id,
    title: cleanTitle,
    url: cleanUrl,
    note: cleanResourceNote(note),
    authorUid: user.id,
    authorEmail: user.email,
    churchId: user.churchId!,
    createdAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/resources/${regionId}/${id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadGroups(regionId: string): Promise<CommunityGroup[]> {
  requireCommunityUser();
  if (!regionId) return [];
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/groups/${regionId}`, token);
    return groupsFromMap(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

function memberPayload(
  user: { id: string; churchId: string | null; email: string },
  meta?: { nickname?: string; churchName?: string; isOwner?: boolean },
) {
  return {
    nickname: cleanNickname(meta?.nickname || "") || nicknameFromEmail(user.email),
    churchId: user.churchId || "",
    churchName: cleanShort(meta?.churchName || "", 40),
    joinedAt: Date.now(),
    isOwner: Boolean(meta?.isOwner),
  };
}

export async function createGroup(
  regionId: string,
  input: {
    title: string;
    category: string;
    place: string;
    schedule: string;
    capacity: number;
    churchName?: string;
    description?: string;
    authorNick?: string;
  },
): Promise<CommunityGroup> {
  const user = requireCommunityUser();
  if (!regionId) throw new Error("지역을 먼저 정해 주세요.");
  if (!isGroupCategory(input.category)) throw new Error("모임 종류를 골라 주세요.");
  const title = cleanGroupTitle(input.title);
  if (!title) throw new Error("모임 제목을 입력해 주세요.");
  const id = newCommunityId("grp");
  const churchName = churchNameOf(user, input.churchName || "");
  const row: CommunityGroup = {
    id,
    title,
    category: input.category,
    place: cleanShort(input.place || "미정", 40) || "미정",
    schedule: cleanShort(input.schedule || "협의", 40) || "협의",
    description: cleanPostBody(input.description || ""),
    capacity: Math.max(1, Math.min(200, Math.floor(input.capacity) || 10)),
    memberCount: 1,
    authorUid: user.id,
    churchId: user.churchId!,
    churchName,
    createdAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(
      `community/groups/${regionId}/${id}`,
      {
        ...row,
        members: {
          [user.id]: memberPayload(user, {
            nickname: input.authorNick,
            churchName,
            isOwner: true,
          }),
        },
      },
      token,
    );
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function joinGroup(
  regionId: string,
  group: CommunityGroup,
  meta?: { nickname?: string; churchName?: string },
): Promise<CommunityGroup> {
  const user = requireCommunityUser();
  if (!regionId || !group.id) throw new Error("모임을 다시 열어 주세요.");
  if (group.memberCount >= group.capacity) throw new Error("정원이 가득 찼습니다.");
  const memberCount = group.memberCount + 1;
  try {
    const token = await authToken();
    await dbSet(
      `community/groups/${regionId}/${group.id}/members/${user.id}`,
      memberPayload(user, meta),
      token,
    );
    await dbPatch(`community/groups/${regionId}/${group.id}`, { memberCount }, token);
    return { ...group, memberCount };
  } catch (error) {
    rethrowCommunity(error);
  }
}

/** 모임 나가기. 모임장은 나가기 대신 모임을 삭제해야 합니다. */
export async function leaveGroup(regionId: string, group: CommunityGroup): Promise<void> {
  const user = requireCommunityUser();
  if (!regionId || !group.id) throw new Error("모임을 다시 열어 주세요.");
  if (group.authorUid === user.id) {
    throw new Error("모임장은 나갈 수 없습니다. 모임을 삭제해 주세요.");
  }
  try {
    const token = await authToken();
    await dbSet(`community/groups/${regionId}/${group.id}/members/${user.id}`, null, token);
    const nextCount = Math.max(0, group.memberCount - 1);
    await dbPatch(`community/groups/${regionId}/${group.id}`, { memberCount: nextCount }, token);
  } catch (error) {
    rethrowCommunity(error);
  }
}

/** 모임장(또는 생성자)이 모임 전체를 삭제합니다. */
export async function deleteCommunityGroup(regionId: string, group: CommunityGroup): Promise<void> {
  const user = requireCommunityUser();
  if (!regionId || !group.id) throw new Error("모임을 다시 열어 주세요.");
  if (group.authorUid !== user.id) throw new Error("모임장만 모임을 삭제할 수 있습니다.");
  try {
    const token = await authToken();
    await dbSet(`community/groups/${regionId}/${group.id}`, null, token);
  } catch (error) {
    rethrowCommunity(error);
  }
}

/** 모임장이 멤버를 내보냅니다. */
export async function removeGroupMember(
  regionId: string,
  group: CommunityGroup,
  memberUid: string,
): Promise<CommunityGroup> {
  const user = requireCommunityUser();
  if (!regionId || !group.id) throw new Error("모임을 다시 열어 주세요.");
  if (group.authorUid !== user.id) throw new Error("모임장만 멤버를 내보낼 수 있습니다.");
  const uid = String(memberUid || "").trim();
  if (!uid) throw new Error("멤버를 다시 확인해 주세요.");
  if (uid === group.authorUid) throw new Error("모임장은 내보낼 수 없습니다.");
  try {
    const token = await authToken();
    await dbSet(`community/groups/${regionId}/${group.id}/members/${uid}`, null, token);
    const memberCount = Math.max(0, group.memberCount - 1);
    await dbPatch(`community/groups/${regionId}/${group.id}`, { memberCount }, token);
    return { ...group, memberCount };
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadGroup(regionId: string, groupId: string): Promise<CommunityGroup | null> {
  requireCommunityUser();
  if (!regionId || !groupId) return null;
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/groups/${regionId}/${groupId}`, token);
    return groupFromRaw(raw, groupId);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadGroupMembers(regionId: string, groupId: string, ownerUid = ""): Promise<GroupMember[]> {
  requireCommunityUser();
  if (!regionId || !groupId) return [];
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/groups/${regionId}/${groupId}/members`, token);
    return membersFromMap(raw, ownerUid);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadGroupPosts(regionId: string, groupId: string): Promise<GroupPost[]> {
  requireCommunityUser();
  if (!regionId || !groupId) return [];
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/groups/${regionId}/${groupId}/posts`, token);
    return groupPostsFromMap(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function createGroupPost(
  regionId: string,
  groupId: string,
  title: string,
  body: string,
  authorNick?: string,
): Promise<GroupPost> {
  const user = requireCommunityUser();
  if (!regionId || !groupId) throw new Error("모임을 다시 열어 주세요.");
  const cleanTitle = cleanPostTitle(title);
  const cleanBody = cleanPostBody(body);
  if (!cleanTitle) throw new Error("제목을 입력해 주세요.");
  if (!cleanBody) throw new Error("내용을 입력해 주세요.");
  const id = newCommunityId("gpost");
  const row: GroupPost = {
    id,
    title: cleanTitle,
    body: cleanBody,
    authorUid: user.id,
    authorNick: cleanNickname(authorNick || "") || nicknameFromEmail(user.email),
    churchId: user.churchId!,
    createdAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/groups/${regionId}/${groupId}/posts/${id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadGroupSchedule(regionId: string, groupId: string): Promise<GroupScheduleItem[]> {
  requireCommunityUser();
  if (!regionId || !groupId) return [];
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/groups/${regionId}/${groupId}/schedule`, token);
    return groupScheduleFromMap(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function createGroupSchedule(
  regionId: string,
  groupId: string,
  title: string,
  when: string,
  place: string,
  authorNick?: string,
): Promise<GroupScheduleItem> {
  const user = requireCommunityUser();
  if (!regionId || !groupId) throw new Error("모임을 다시 열어 주세요.");
  const cleanTitle = cleanPostTitle(title);
  if (!cleanTitle) throw new Error("일정 제목을 입력해 주세요.");
  const id = newCommunityId("gsch");
  const row: GroupScheduleItem = {
    id,
    title: cleanTitle,
    when: cleanShort(when || "", 60) || "미정",
    place: cleanShort(place || "", 40) || "미정",
    authorUid: user.id,
    authorNick: cleanNickname(authorNick || "") || nicknameFromEmail(user.email),
    createdAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/groups/${regionId}/${groupId}/schedule/${id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function deleteGroupSchedule(regionId: string, groupId: string, scheduleId: string): Promise<void> {
  requireCommunityUser();
  if (!regionId || !groupId || !scheduleId) throw new Error("일정을 다시 확인해 주세요.");
  try {
    const token = await authToken();
    await dbSet(`community/groups/${regionId}/${groupId}/schedule/${scheduleId}`, null, token);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadGroupAlbum(regionId: string, groupId: string): Promise<GroupAlbumItem[]> {
  requireCommunityUser();
  if (!regionId || !groupId) return [];
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/groups/${regionId}/${groupId}/album`, token);
    return groupAlbumFromMap(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function createGroupAlbumItem(
  regionId: string,
  groupId: string,
  title: string,
  url: string,
  note = "",
  authorNick?: string,
): Promise<GroupAlbumItem> {
  const user = requireCommunityUser();
  if (!regionId || !groupId) throw new Error("모임을 다시 열어 주세요.");
  const cleanTitle = cleanResourceTitle(title);
  const cleanUrl = cleanResourceUrl(url);
  if (!cleanTitle) throw new Error("제목을 입력해 주세요.");
  if (!cleanUrl) throw new Error("https:// 로 시작하는 링크를 입력해 주세요.");
  const id = newCommunityId("galb");
  const row: GroupAlbumItem = {
    id,
    title: cleanTitle,
    note: cleanResourceNote(note),
    url: cleanUrl,
    authorUid: user.id,
    authorNick: cleanNickname(authorNick || "") || nicknameFromEmail(user.email),
    createdAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/groups/${regionId}/${groupId}/album/${id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadMyGroupIds(regionId: string): Promise<Set<string>> {
  const user = requireCommunityUser();
  if (!regionId) return new Set();
  try {
    const token = await authToken();
    const groups = await loadGroups(regionId);
    const mine = new Set<string>();
    await Promise.all(
      groups.map(async (g) => {
        const raw = await dbGet<unknown>(`community/groups/${regionId}/${g.id}/members/${user.id}`, token);
        if (raw) mine.add(g.id);
      }),
    );
    return mine;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadChurchNotices(churchId: string): Promise<ChurchNotice[]> {
  requireCommunityUser();
  if (!churchId) return [];
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/churches/${churchId}/notices`, token);
    return noticesFromMap(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function createChurchNotice(churchId: string, title: string, body: string): Promise<ChurchNotice> {
  const user = requireCommunityUser();
  if (!churchId) throw new Error("교회를 먼저 열어 주세요.");
  const cleanTitle = cleanPostTitle(title);
  const cleanBody = cleanPostBody(body);
  if (!cleanTitle) throw new Error("제목을 입력해 주세요.");
  if (!cleanBody) throw new Error("내용을 입력해 주세요.");
  const id = newCommunityId("ntc");
  const row: ChurchNotice = {
    id,
    title: cleanTitle,
    body: cleanBody,
    authorUid: user.id,
    createdAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/churches/${churchId}/notices/${id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadChurchSchedule(churchId: string): Promise<ChurchScheduleItem[]> {
  requireCommunityUser();
  if (!churchId) return [];
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/churches/${churchId}/schedule`, token);
    return scheduleFromMap(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function createChurchSchedule(
  churchId: string,
  title: string,
  when: string,
  place: string,
): Promise<ChurchScheduleItem> {
  const user = requireCommunityUser();
  if (!churchId) throw new Error("교회를 먼저 열어 주세요.");
  const cleanTitle = cleanPostTitle(title);
  if (!cleanTitle) throw new Error("일정 제목을 입력해 주세요.");
  const id = newCommunityId("sch");
  const row: ChurchScheduleItem = {
    id,
    title: cleanTitle,
    when: cleanShort(when || "", 60) || "미정",
    place: cleanShort(place || "", 40) || "미정",
    authorUid: user.id,
    createdAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/churches/${churchId}/schedule/${id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}

export async function loadChats(): Promise<ChatThread[]> {
  const user = requireCommunityUser();
  try {
    const token = await authToken();
    const raw = await dbGet<unknown>(`community/chats/${user.id}`, token);
    return chatsFromMap(raw);
  } catch (error) {
    rethrowCommunity(error);
  }
}

/** 채팅 MVP: 스레드 껍데기만 만듭니다. 실시간 메시지는 이후 단계. */
export async function createChatShell(title: string, kind: "personal" | "group" = "personal"): Promise<ChatThread> {
  const user = requireCommunityUser();
  const id = newCommunityId("chat");
  const row: ChatThread = {
    id,
    kind,
    title: cleanShort(title || "새 채팅", 40) || "새 채팅",
    peerUid: "",
    unread: false,
    updatedAt: Date.now(),
  };
  try {
    const token = await authToken();
    await dbSet(`community/chats/${user.id}/${id}`, row, token);
    return row;
  } catch (error) {
    rethrowCommunity(error);
  }
}
