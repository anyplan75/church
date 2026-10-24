"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createDiscussionPost, createDiscussionReply, DiscussionFlowError, readableDiscussionError } from "@/server/discussion/service";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableDiscussionError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createDiscussionPostAction(formData: FormData) {
  const parsed = z
    .object({
      title: z.string().trim().min(1, "제목을 적어 주세요.").max(160, "제목은 160자 안으로 적어 주세요."),
      body: z.string().trim().min(1, "글을 적어 주세요.").max(4000, "글은 4000자 안으로 적어 주세요."),
      placeRefs: z.array(z.string().trim().min(1)).min(1, "글을 올릴 범위를 골라 주세요."),
      anonymous: z.boolean(),
    })
    .safeParse({
      title: text(formData, "title"),
      body: text(formData, "body"),
      placeRefs: formData.getAll("placeRef").filter((item): item is string => typeof item === "string" && item.trim().length > 0),
      anonymous: formData.get("anonymous") === "1",
    });
  if (!parsed.success) fail("/discussion", new DiscussionFlowError(parsed.error.issues[0]?.message ?? "글을 확인해 주세요."));
  let postId = "";
  try {
    postId = await createDiscussionPost(parsed.data);
  } catch (error) {
    fail("/discussion", error);
  }
  redirect(`/discussion/${postId}?ok=post`);
}

export async function createDiscussionReplyAction(formData: FormData) {
  const postId = text(formData, "postId");
  const back = `/discussion/${postId}`;
  const parsed = z
    .object({
      postId: z.string().uuid("글을 찾지 못했습니다."),
      body: z.string().trim().min(1, "답글을 적어 주세요.").max(4000, "답글은 4000자 안으로 적어 주세요."),
      anonymous: z.boolean(),
    })
    .safeParse({
      postId,
      body: text(formData, "body"),
      anonymous: formData.get("anonymous") === "1",
    });
  if (!parsed.success) fail(postId ? back : "/discussion", new DiscussionFlowError(parsed.error.issues[0]?.message ?? "답글을 확인해 주세요."));
  try {
    await createDiscussionReply(parsed.data);
  } catch (error) {
    fail(back, error);
  }
  redirect(`${back}?ok=reply`);
}
