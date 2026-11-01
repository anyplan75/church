"use server";

import { redirect } from "next/navigation";
import type { BoardPlaceKind } from "@/board/rules";
import {
  createPlaceBoardPost,
  deletePlaceBoardPost,
  readableBoardError,
  updatePlaceBoardPost,
} from "@/server/board/service";

function kindOf(value: string): BoardPlaceKind {
  if (value === "church" || value === "gathering") return value;
  throw new Error("교회나 모들을 찾지 못했습니다.");
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableBoardError(error))}`);
}

export async function createPlaceBoardPostAction(formData: FormData) {
  const kind = kindOf(text(formData, "kind"));
  const placeId = text(formData, "placeId");
  const back = `/promo/${kind}/${placeId}/board/new`;
  let postId = "";
  try {
    postId = await createPlaceBoardPost(kind, placeId, text(formData, "title"), text(formData, "body"));
  } catch (error) {
    fail(back, error);
  }
  redirect(`/promo/${kind}/${placeId}/board/${postId}`);
}

export async function updatePlaceBoardPostAction(formData: FormData) {
  const kind = kindOf(text(formData, "kind"));
  const placeId = text(formData, "placeId");
  const postId = text(formData, "postId");
  const back = `/promo/${kind}/${placeId}/board/${postId}`;
  try {
    await updatePlaceBoardPost(kind, placeId, postId, text(formData, "title"), text(formData, "body"));
  } catch (error) {
    fail(back, error);
  }
  redirect(`${back}?ok=saved`);
}

export async function deletePlaceBoardPostAction(formData: FormData) {
  const kind = kindOf(text(formData, "kind"));
  const placeId = text(formData, "placeId");
  const postId = text(formData, "postId");
  const back = `/promo/${kind}/${placeId}/board/${postId}`;
  try {
    await deletePlaceBoardPost(kind, placeId, postId);
  } catch (error) {
    fail(back, error);
  }
  redirect(`/promo/${kind}/${placeId}?ok=board-deleted`);
}
