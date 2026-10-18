import { authToken, currentUser } from "./app-db";
import {
  cleanCommentBody,
  cleanDistrict,
  cleanPostBody,
  cleanPostTitle,
  cleanResourceNote,
  cleanResourceTitle,
  cleanResourceUrl,
  commentsFromMap,
  isCommunitySido,
  isPostCategory,
  membershipFromRaw,
  newCommunityId,
  postsFromMap,
  regionIdFrom,
  regionLabel,
  resourcesFromMap,
  type CommunityComment,
  type CommunityMembership,
  type CommunityPost,
  type CommunityResource,
  type PostCategory,
} from "./community";
import { dbGet, dbSet } from "./firebase-db";

function requireChurchUser() {
  const user = currentUser();
  if (!user || user.kind !== "church" || !user.churchId) {
    throw new Error("교회 계정으로 로그인해 주세요.");
  }
  return user;
}

export async function loadMembership(): Promise<CommunityMembership | null> {
  const user = requireChurchUser();
  const token = await authToken();
  const raw = await dbGet<unknown>(`community/memberships/${user.id}`, token);
  return membershipFromRaw(raw);
}

export async function saveMembership(sido: string, district = ""): Promise<CommunityMembership> {
  const user = requireChurchUser();
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
  const token = await authToken();
  await dbSet(`community/regions/${regionId}`, { name: regionLabel(row.sido, row.district), sido: row.sido, district: row.district }, token);
  await dbSet(`community/memberships/${user.id}`, row, token);
  return row;
}

export async function loadPosts(regionId: string): Promise<CommunityPost[]> {
  requireChurchUser();
  if (!regionId) return [];
  const token = await authToken();
  const raw = await dbGet<unknown>(`community/posts/${regionId}`, token);
  return postsFromMap(raw);
}

export async function createPost(regionId: string, title: string, body: string, category: PostCategory): Promise<CommunityPost> {
  const user = requireChurchUser();
  if (!regionId) throw new Error("지역을 먼저 정해 주세요.");
  if (!isPostCategory(category)) throw new Error("글 종류를 골라 주세요.");
  const cleanTitle = cleanPostTitle(title);
  const cleanBody = cleanPostBody(body);
  if (!cleanTitle) throw new Error("제목을 입력해 주세요.");
  if (!cleanBody) throw new Error("내용을 입력해 주세요.");
  const id = newCommunityId("post");
  const row: CommunityPost = {
    id,
    title: cleanTitle,
    body: cleanBody,
    category,
    authorUid: user.id,
    authorEmail: user.email,
    churchId: user.churchId!,
    createdAt: Date.now(),
  };
  const token = await authToken();
  await dbSet(`community/posts/${regionId}/${id}`, row, token);
  return row;
}

export async function loadComments(regionId: string, postId: string): Promise<CommunityComment[]> {
  requireChurchUser();
  if (!regionId || !postId) return [];
  const token = await authToken();
  const raw = await dbGet<unknown>(`community/posts/${regionId}/${postId}/comments`, token);
  return commentsFromMap(raw);
}

export async function createComment(regionId: string, postId: string, body: string): Promise<CommunityComment> {
  const user = requireChurchUser();
  if (!regionId || !postId) throw new Error("글을 다시 열어 주세요.");
  const cleanBody = cleanCommentBody(body);
  if (!cleanBody) throw new Error("댓글을 입력해 주세요.");
  const id = newCommunityId("cmt");
  const row: CommunityComment = {
    id,
    body: cleanBody,
    authorUid: user.id,
    authorEmail: user.email,
    createdAt: Date.now(),
  };
  const token = await authToken();
  await dbSet(`community/posts/${regionId}/${postId}/comments/${id}`, row, token);
  return row;
}

export async function loadResources(regionId: string): Promise<CommunityResource[]> {
  requireChurchUser();
  if (!regionId) return [];
  const token = await authToken();
  const raw = await dbGet<unknown>(`community/resources/${regionId}`, token);
  return resourcesFromMap(raw);
}

export async function createResource(regionId: string, title: string, url: string, note = ""): Promise<CommunityResource> {
  const user = requireChurchUser();
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
  const token = await authToken();
  await dbSet(`community/resources/${regionId}/${id}`, row, token);
  return row;
}
