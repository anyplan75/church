"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { readableWebsiteError, resolveInquiry, saveWebsite, submitInquiry, WebsiteFlowError } from "@/server/website/service";
import { parseBlocksJson, parseSeo, parseTheme, publicSitePath } from "@/website/rules";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableWebsiteError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveWebsiteAction(formData: FormData) {
  const blocks = parseBlocksJson(text(formData, "blocksJson"));
  if (!blocks.ok) fail("/website", new WebsiteFlowError(blocks.message));
  let themeRaw: unknown = {};
  let seoRaw: unknown = {};
  try {
    themeRaw = JSON.parse(text(formData, "themeJson") || "{}");
    seoRaw = JSON.parse(text(formData, "seoJson") || "{}");
  } catch {
    fail("/website", new WebsiteFlowError("디자인이나 검색 설정의 모양이 맞지 않습니다."));
  }
  try {
    await saveWebsite({
      blocks: blocks.ok ? blocks.blocks : [],
      theme: parseTheme(themeRaw),
      seo: parseSeo(seoRaw),
    });
  } catch (error) {
    fail("/website", error);
  }
  redirect("/website?ok=website");
}

export async function submitInquiryAction(formData: FormData) {
  const slug = text(formData, "slug");
  const parsed = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "홈페이지 주소가 맞지 않습니다.")
    .safeParse(slug);
  const back = parsed.success ? publicSitePath(parsed.data) : "/";
  if (!parsed.success) fail("/", new WebsiteFlowError("홈페이지 주소가 맞지 않습니다."));
  try {
    await submitInquiry({
      slug: parsed.success ? parsed.data : "",
      visitorName: text(formData, "visitorName"),
      visitorContact: text(formData, "visitorContact"),
      message: text(formData, "message"),
    });
  } catch (error) {
    fail(back, error);
  }
  redirect(`${back}?ok=inquiry`);
}

export async function resolveInquiryAction(formData: FormData) {
  const inquiryId = text(formData, "inquiryId");
  const parsed = z.string().uuid("문의를 찾지 못했습니다.").safeParse(inquiryId);
  if (!parsed.success) fail("/website", new WebsiteFlowError("문의를 찾지 못했습니다."));
  try {
    await resolveInquiry(parsed.data);
  } catch (error) {
    fail("/website", error);
  }
  redirect("/website?ok=resolved");
}
