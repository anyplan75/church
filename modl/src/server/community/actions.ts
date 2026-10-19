"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { closeSession } from "@/server/auth/session";
import {
  applyToJoin,
  assignMemberToGroup,
  createCommunity,
  createGroup,
  issueInvite,
  loginAccount,
  readableError,
  reviewApproval,
  saveRosterMember,
  signupAccount,
  startSeason,
} from "@/server/community/service";
import { parseTermOverridesStrict } from "@/theme/resolve-term";
import type { MemberRole } from "@/server/auth/actor";

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(readableError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const roleSchema = z.enum(["PASTOR", "EXECUTIVE", "CELL_LEADER", "MEMBER", "NEWCOMER"]);
const statusSchema = z.enum(["ACTIVE", "LONG_ABSENT", "GRADUATED"]);

function optionalPhone(value: string): string | null {
  return value ? value : null;
}

export async function signupAction(formData: FormData) {
  const parsed = z
    .object({
      name: z.string().trim().min(1, "이름을 적어 주세요."),
      email: z.string().trim().email("이메일 모양을 확인해 주세요.").transform((value) => value.toLowerCase()),
      password: z.string().min(8, "비밀번호는 8자 이상으로 해 주세요."),
    })
    .safeParse({
      name: text(formData, "name"),
      email: text(formData, "email"),
      password: text(formData, "password"),
    });
  if (!parsed.success) fail("/account", new Error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요."));
  try {
    await signupAccount(parsed.data);
  } catch (error) {
    fail("/account", error);
  }
  redirect("/community/new");
}

export async function loginAction(formData: FormData) {
  const parsed = z
    .object({
      email: z.string().trim().email("이메일 모양을 확인해 주세요.").transform((value) => value.toLowerCase()),
      password: z.string().min(1, "비밀번호를 적어 주세요."),
    })
    .safeParse({
      email: text(formData, "email"),
      password: text(formData, "password"),
    });
  if (!parsed.success) fail("/account", new Error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요."));
  try {
    await loginAccount(parsed.data);
  } catch (error) {
    fail("/account", error);
  }
  redirect("/roster");
}

export async function logoutAction() {
  await closeSession();
  redirect("/account");
}

export async function createCommunityAction(formData: FormData) {
  const overridesText = text(formData, "overrides");
  let overrides = {};
  if (overridesText) {
    let json: unknown;
    try {
      json = JSON.parse(overridesText);
    } catch {
      fail("/community/new", new Error("용어 덮어쓰기는 JSON 모양으로 적어 주세요."));
    }
    const parsedOverrides = parseTermOverridesStrict(json);
    if (!parsedOverrides) fail("/community/new", new Error("용어 덮어쓰기 칸의 모양이 맞지 않습니다."));
    overrides = parsedOverrides;
  }
  const parsed = z
    .object({
      name: z.string().trim().min(1, "공동체 이름을 적어 주세요."),
      churchName: z.string().trim().min(1, "교회 이름을 적어 주세요."),
      denomination: z.string().trim().min(1, "교단을 적어 주세요."),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "주소 이름은 영어 소문자, 숫자, 하이픈만 씁니다."),
      planTier: z.enum(["FREE", "PRO"]),
      languageMode: z.enum(["JEJU_DUAL", "JEJU_ONLY", "STANDARD"]),
      phone: z.string().trim(),
    })
    .safeParse({
      name: text(formData, "name"),
      churchName: text(formData, "churchName"),
      denomination: text(formData, "denomination"),
      slug: text(formData, "slug"),
      planTier: text(formData, "planTier") || "FREE",
      languageMode: text(formData, "languageMode") || "JEJU_DUAL",
      phone: text(formData, "phone"),
    });
  if (!parsed.success) fail("/community/new", new Error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요."));
  try {
    await createCommunity({
      ...parsed.data,
      phone: optionalPhone(parsed.data.phone),
      requireApproval: formData.get("requireApproval") === "yes",
      customTermOverrides: overrides,
    });
  } catch (error) {
    fail("/community/new", error);
  }
  redirect("/roster?ok=community");
}

export async function issueInviteAction(formData: FormData) {
  const raw = text(formData, "maxUses");
  const maxUses = raw ? Number(raw) : null;
  if (raw && (!Number.isInteger(maxUses) || (maxUses ?? 0) < 1)) {
    fail("/invite", new Error("쓸 수 있는 횟수는 1 이상의 정수로 적어 주세요."));
  }
  try {
    await issueInvite(maxUses);
  } catch (error) {
    fail("/invite", error);
  }
  redirect("/invite?ok=invite");
}

export async function applyJoinAction(formData: FormData) {
  const parsed = z
    .object({
      code: z.string().trim().min(1, "초대 코드를 적어 주세요.").transform((value) => value.toUpperCase()),
      denomination: z.string().trim().min(1, "교단을 적어 주세요."),
      phone: z.string().trim().min(1, "전화번호를 적어 주세요."),
      name: z.string().trim().min(1, "이름을 적어 주세요."),
    })
    .safeParse({
      code: text(formData, "code"),
      denomination: text(formData, "denomination"),
      phone: text(formData, "phone"),
      name: text(formData, "name"),
    });
  if (!parsed.success) fail("/join", new Error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요."));
  try {
    await applyToJoin(parsed.data);
  } catch (error) {
    fail("/join", error);
  }
  redirect("/join?ok=applied");
}

export async function reviewApprovalAction(formData: FormData) {
  const requestId = text(formData, "requestId");
  const decision = text(formData, "decision") === "REJECTED" ? "REJECTED" : "APPROVED";
  try {
    await reviewApproval(requestId, decision);
  } catch (error) {
    fail("/approvals", error);
  }
  redirect(decision === "APPROVED" ? "/roster?ok=approved" : "/approvals?ok=rejected");
}

function rosterInput(formData: FormData) {
  const parsed = z
    .object({
      name: z.string().trim().min(1, "이름을 적어 주세요."),
      phone: z.string().trim(),
      birthDate: z.string().trim(),
      gender: z.string().trim(),
      role: roleSchema,
      status: statusSchema,
      groupId: z.string().trim(),
    })
    .safeParse({
      name: text(formData, "name"),
      phone: text(formData, "phone"),
      birthDate: text(formData, "birthDate"),
      gender: text(formData, "gender"),
      role: text(formData, "role") || "MEMBER",
      status: text(formData, "status") || "ACTIVE",
      groupId: text(formData, "groupId"),
    });
  return parsed;
}

export async function createRosterAction(formData: FormData) {
  const parsed = rosterInput(formData);
  if (!parsed.success) fail("/roster/new", new Error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요."));
  try {
    await saveRosterMember({
      memberId: null,
      name: parsed.data.name,
      phone: optionalPhone(parsed.data.phone),
      birthDate: parsed.data.birthDate || null,
      gender: parsed.data.gender || null,
      role: parsed.data.role as MemberRole,
      status: parsed.data.status,
      groupId: parsed.data.groupId || null,
    });
  } catch (error) {
    fail("/roster/new", error);
  }
  redirect("/roster?ok=roster");
}

export async function updateRosterAction(formData: FormData) {
  const memberId = text(formData, "memberId");
  const parsed = rosterInput(formData);
  if (!parsed.success) fail(`/roster/${memberId}`, new Error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요."));
  try {
    await saveRosterMember({
      memberId,
      name: parsed.data.name,
      phone: optionalPhone(parsed.data.phone),
      birthDate: parsed.data.birthDate || null,
      gender: parsed.data.gender || null,
      role: parsed.data.role as MemberRole,
      status: parsed.data.status,
      groupId: parsed.data.groupId || null,
    });
  } catch (error) {
    fail(`/roster/${memberId}`, error);
  }
  redirect("/roster?ok=roster");
}

export async function startSeasonAction(formData: FormData) {
  const year = Number(text(formData, "year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    fail("/group", new Error("시즌 연도는 2000년부터 2100년 사이로 적어 주세요."));
  }
  try {
    await startSeason(year);
  } catch (error) {
    fail("/group", error);
  }
  redirect(`/group?year=${year}&ok=season`);
}

export async function createGroupAction(formData: FormData) {
  const year = Number(text(formData, "year"));
  const parsed = z
    .object({
      name: z.string().trim().min(1, "모들 이름을 적어 주세요."),
      leaderMemberId: z.string().trim(),
    })
    .safeParse({
      name: text(formData, "name"),
      leaderMemberId: text(formData, "leaderMemberId"),
    });
  if (!Number.isInteger(year) || !parsed.success) {
    fail("/group", new Error(parsed.success ? "시즌 연도를 확인해 주세요." : parsed.error.issues[0]?.message));
  }
  if (!parsed.success) return;
  try {
    await createGroup({
      seasonYear: year,
      name: parsed.data.name,
      leaderMemberId: parsed.data.leaderMemberId || null,
    });
  } catch (error) {
    fail(`/group?year=${year}`, error);
  }
  redirect(`/group?year=${year}&ok=group`);
}

export async function assignGroupAction(formData: FormData) {
  const year = text(formData, "year");
  try {
    await assignMemberToGroup({
      groupId: text(formData, "groupId"),
      memberId: text(formData, "memberId"),
    });
  } catch (error) {
    fail(`/group?year=${year}`, error);
  }
  redirect(`/group?year=${year}&ok=assign`);
}
