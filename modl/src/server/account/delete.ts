/**
 * 로그인한 사람의 계정과 개인 데이터를 지웁니다.
 * 교회가 적어 둔 안내와 재정 내역은 남깁니다. 그 기록에 걸린 사람 연결만 풉니다.
 */

import { eq, inArray, sql } from "drizzle-orm";
import { accountDeleteConfirmError } from "@/account/delete-rules";
import { CommunityFlowError } from "@/server/community/service";
import { closeSession, loadActor } from "@/server/auth/session";
import {
  approvalRequests,
  members,
  oauthPending,
  surveyResponses,
  users,
  websiteInquiries,
} from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";

export async function deleteOwnAccount(confirm: string): Promise<void> {
  const confirmError = accountDeleteConfirmError(confirm);
  if (confirmError) throw new CommunityFlowError(confirmError);

  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") throw new CommunityFlowError("먼저 들어가 주세요.");

  const db = getDb();
  const [user] = await db
    .select({ id: users.id, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);
  if (!user) throw new CommunityFlowError("계정을 찾지 못했습니다.");

  const memberRows = await db.select({ id: members.id }).from(members).where(eq(members.userId, user.id));
  const memberIds = memberRows.map((row) => row.id);
  const email = user.email.trim().toLowerCase();
  const phone = user.phone?.trim() ?? "";

  await db.transaction(async (tx) => {
    if (memberIds.length > 0) {
      await tx.delete(surveyResponses).where(inArray(surveyResponses.memberId, memberIds));
      await tx.delete(approvalRequests).where(inArray(approvalRequests.memberId, memberIds));
    }
    await tx.delete(approvalRequests).where(eq(approvalRequests.applicantUserId, user.id));
    if (email) {
      await tx.delete(oauthPending).where(sql`lower(${oauthPending.email}) = ${email}`);
      await tx.delete(websiteInquiries).where(sql`lower(${websiteInquiries.visitorContact}) = ${email}`);
    }
    if (phone) {
      await tx.delete(websiteInquiries).where(eq(websiteInquiries.visitorContact, phone));
    }
    if (memberIds.length > 0) {
      await tx.delete(members).where(inArray(members.id, memberIds));
    }
    const removed = await tx.delete(users).where(eq(users.id, user.id)).returning({ id: users.id });
    if (removed.length === 0) throw new CommunityFlowError("계정을 찾지 못했습니다.");
  });

  await closeSession();
}
