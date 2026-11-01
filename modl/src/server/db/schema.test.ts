import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getTableName } from "drizzle-orm";
import { createDbFromEnv } from "@/server/db/client";
import {
  approvalStatusEnum,
  attendanceStatusEnum,
  calendarCategoryEnum,
  checkMethodEnum,
  dbSchema,
  departmentTypeEnum,
  financeTypeEnum,
  languageModeEnum,
  memberCohortEnum,
  memberRoleEnum,
  memberStatusEnum,
  planTierEnum,
  prayerVisibilityEnum,
  questionAudienceEnum,
  questionReplyStatusEnum,
} from "@/server/db/schema";

const migrationDir = path.join(process.cwd(), "src/server/db/migrations");
const sql = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(path.join(migrationDir, name), "utf8"))
  .join("\n");

describe("표 정의와 마이그레이션", () => {
  it("정의된 표가 실행 명령 안에 모두 있습니다", () => {
    const tables = Object.values(dbSchema);
    assert.equal(tables.length, 35);
    for (const table of tables) {
      const name = getTableName(table);
      assert.match(sql, new RegExp(`CREATE TABLE ${name}\\b`));
    }
  });

  it("역할 코드에 손님과 미가입은 없습니다", () => {
    assert.deepEqual(memberRoleEnum.enumValues, [
      "PASTOR",
      "EXECUTIVE",
      "CELL_LEADER",
      "MEMBER",
      "NEWCOMER",
    ]);
  });

  it("지정한 코드 묶음이 명령 파일과 같습니다", () => {
    const enums: Array<[string, readonly string[]]> = [
      ["plan_tier", planTierEnum.enumValues],
      ["language_mode", languageModeEnum.enumValues],
      ["member_status", memberStatusEnum.enumValues],
      ["approval_status", approvalStatusEnum.enumValues],
      ["department_type", departmentTypeEnum.enumValues],
      ["attendance_status", attendanceStatusEnum.enumValues],
      ["check_method", checkMethodEnum.enumValues],
      ["calendar_category", calendarCategoryEnum.enumValues],
      ["prayer_visibility", prayerVisibilityEnum.enumValues],
      ["finance_type", financeTypeEnum.enumValues],
      ["member_cohort", memberCohortEnum.enumValues],
      ["question_audience", questionAudienceEnum.enumValues],
      ["question_reply_status", questionReplyStatusEnum.enumValues],
    ];
    for (const [name, values] of enums) {
      assert.match(sql, new RegExp(`CREATE TYPE ${name} AS ENUM \\('${values.join("', '")}'\\)`));
    }
  });

  it("겹치면 안 되는 칸과 공동체 인덱스가 있습니다", () => {
    const required = [
      "communities_slug_uidx",
      "bulletins_share_token_uidx",
      "attendance_records_session_member_uidx",
      "prayer_reactions_request_member_uidx",
      "qt_grace_reactions_reflection_member_uidx",
      "qt_reflections_qt_member_uidx",
      "attendance_sessions_qr_checkin_token_uidx",
      "members_current_group_id_fk",
      "members_community_id_idx",
      "small_groups_community_id_idx",
      "bulletins_community_id_idx",
      "attendance_sessions_community_id_idx",
      "calendar_events_community_id_idx",
      "daily_qts_community_id_idx",
      "prayer_requests_community_id_idx",
      "finance_categories_community_id_idx",
      "transactions_community_id_idx",
      "surveys_community_id_idx",
      "survey_responses_survey_id_idx",
      "meeting_minutes_community_id_idx",
      "event_archives_community_id_idx",
      "quizzes_community_id_idx",
      "quiz_month_prizes_community_month_uidx",
      "website_configs_community_id_uidx",
      "website_inquiries_community_id_idx",
      "questions_community_id_idx",
      "question_replies_question_id_idx",
      "banned_words_word_uidx",
      "invite_codes_community_id_idx",
      "approval_requests_community_id_idx",
      "ON DELETE CASCADE",
      "ON DELETE SET NULL",
    ];
    for (const token of required) {
      assert.ok(sql.includes(token), `${token} 이 마이그레이션에 없습니다`);
    }
  });

  it("환경 변수가 없으면 접속을 열지 않습니다", () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      assert.throws(() => createDbFromEnv(), /DATABASE_URL|데이터베이스 설정이 없습니다/);
    } finally {
      if (previous) process.env.DATABASE_URL = previous;
    }
  });
});
