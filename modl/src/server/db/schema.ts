/**
 * 모들 데이터베이스 표 정의입니다.
 * 실행해서 표를 만드는 명령은 migrations/0001_init.sql 에 따로 있습니다.
 * 이 파일을 불러도 데이터베이스에 접속하지 않습니다.
 *
 * 미가입 명부는 역할이 아닙니다. members.user_id 가 비어 있으면 아직 앱 계정이 없는 명부입니다.
 * 마중 손님은 로그인하지 않은 요청이며 members 줄이 아닙니다.
 */

import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  doublePrecision,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const planTierEnum = pgEnum("plan_tier", ["FREE", "PRO"]);
export const languageModeEnum = pgEnum("language_mode", ["JEJU_DUAL", "JEJU_ONLY", "STANDARD"]);
export const memberRoleEnum = pgEnum("member_role", [
  "PASTOR",
  "EXECUTIVE",
  "CELL_LEADER",
  "MEMBER",
  "NEWCOMER",
]);
export const memberStatusEnum = pgEnum("member_status", ["ACTIVE", "LONG_ABSENT", "GRADUATED"]);
export const approvalStatusEnum = pgEnum("approval_status", ["PENDING", "APPROVED", "REJECTED"]);
export const departmentTypeEnum = pgEnum("department_type", ["YOUTH", "SCHOOL"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["PRESENT", "LATE", "ABSENT", "EXCUSED"]);
export const checkMethodEnum = pgEnum("check_method", ["SELF_QR", "GROUP_LEADER", "EXECUTIVE"]);
export const calendarCategoryEnum = pgEnum("calendar_category", [
  "RETREAT",
  "EVENT",
  "BIRTHDAY",
  "HOLIDAY",
  "ETC",
]);
export const prayerVisibilityEnum = pgEnum("prayer_visibility", [
  "PUBLIC",
  "GROUP_ONLY",
  "LEADER_ONLY",
  "PASTOR_ONLY",
]);
export const financeTypeEnum = pgEnum("finance_type", ["INCOME", "EXPENSE"]);
export const memberCohortEnum = pgEnum("member_cohort", ["PEER", "SENIOR"]);
export const questionAudienceEnum = pgEnum("question_audience", ["PASTORS", "PEERS", "SENIORS"]);
export const questionReplyStatusEnum = pgEnum("question_reply_status", ["PENDING", "APPROVED"]);

function createdAt() {
  return timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
}

function updatedAt() {
  return timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
}

function jsonList(name: string) {
  return jsonb(name).$type<string[]>().notNull().default(sql`'[]'::jsonb`);
}

function jsonValue(name: string) {
  return jsonb(name).$type<unknown>().notNull().default(sql`'[]'::jsonb`);
}

function jsonObject(name: string) {
  return jsonb(name).$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`);
}

/** 앱에 로그인하는 계정입니다. 한 계정이 여러 공동체 명부에 연결될 수 있습니다. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    gender: text("gender"),
    /** 가입 뒤에 고르거나 직접 등록한 다니는 교회입니다. 비밀이 아닙니다. */
    homeChurchId: uuid("home_church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "set null" }),
    /** 지금 갈 모임입니다. 비밀이 아닙니다. */
    currentGroupId: uuid("current_group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_uidx").on(table.email),
    index("users_home_church_id_idx").on(table.homeChurchId),
    index("users_current_group_id_idx").on(table.currentGroupId),
    check("users_gender_check", sql`${table.gender} is null or ${table.gender} in ('male', 'female')`),
  ],
);

/**
 * 카카오·네이버로 들어온 계정 연결입니다.
 * 열쇠 값은 여기에 두지 않습니다. 제공자 번호만 저장합니다.
 */
export const oauthIdentities = pgTable(
  "oauth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("oauth_identities_provider_user_uidx").on(table.provider, table.providerUserId),
    index("oauth_identities_user_id_idx").on(table.userId),
    check("oauth_identities_provider_check", sql`${table.provider} in ('kakao', 'naver')`),
  ],
);

/**
 * 성별이나 전화번호가 없어 아직 끝내지 못한 간편 가입입니다.
 * 열쇠 값은 두지 않습니다.
 */
export const oauthPending = pgTable(
  "oauth_pending",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    gender: text("gender"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("oauth_pending_token_hash_uidx").on(table.tokenHash),
    check("oauth_pending_provider_check", sql`${table.provider} in ('kakao', 'naver')`),
    check("oauth_pending_gender_check", sql`${table.gender} is null or ${table.gender} in ('male', 'female')`),
  ],
);

/**
 * 로그인 상태를 서버에 기억하는 표입니다.
 * 표식 원문은 저장하지 않고 해시만 둡니다.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uidx").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

/** 교회 공동체 하나입니다. 자료는 community_id 로 서로 섞이지 않게 가릅니다. */
export const communities = pgTable(
  "communities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    churchName: text("church_name").notNull(),
    denomination: text("denomination").notNull(),
    slug: text("slug").notNull(),
    planTier: planTierEnum("plan_tier").notNull().default("FREE"),
    requireApproval: boolean("require_approval").notNull().default(false),
    languageMode: languageModeEnum("language_mode").notNull().default("JEJU_DUAL"),
    customTermOverrides: jsonObject("custom_term_overrides"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("communities_slug_uidx").on(table.slug)],
);

/**
 * 공동체 명부입니다.
 * user_id 가 비어 있으면 아직 가입하지 않은 명부입니다. 역할 이름에 UNREGISTERED 는 없습니다.
 */
export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phone: text("phone"),
    birthDate: date("birth_date"),
    gender: text("gender"),
    role: memberRoleEnum("role").notNull().default("MEMBER"),
    cohort: memberCohortEnum("cohort"),
    currentGroupId: uuid("current_group_id").references((): AnyPgColumn => smallGroups.id, {
      onDelete: "set null",
    }),
    status: memberStatusEnum("status").notNull().default("ACTIVE"),
    address: text("address"),
    pickupConsentAt: timestamp("pickup_consent_at", { withTimezone: true }),
    pickupLat: doublePrecision("pickup_lat"),
    pickupLon: doublePrecision("pickup_lon"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("members_community_id_idx").on(table.communityId),
    index("members_user_id_idx").on(table.userId),
    index("members_current_group_id_idx").on(table.currentGroupId),
    index("members_community_status_idx").on(table.communityId, table.status),
  ],
);

/** 계절마다 모이는 모들(소그룹)입니다. */
export const smallGroups = pgTable(
  "small_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    seasonYear: integer("season_year").notNull(),
    name: text("name").notNull(),
    leaderMemberId: uuid("leader_member_id").references((): AnyPgColumn => members.id, {
      onDelete: "set null",
    }),
    isArchived: boolean("is_archived").notNull().default(false),
    address: text("address").notNull().default(""),
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    createdByUserId: uuid("created_by_user_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    slug: text("slug"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("small_groups_community_id_idx").on(table.communityId),
    index("small_groups_leader_member_id_idx").on(table.leaderMemberId),
    index("small_groups_community_season_idx").on(table.communityId, table.seasonYear),
  ],
);

/** 공동체에 들어오는 초대 코드입니다. */
export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    createdByMemberId: uuid("created_by_member_id").references(() => members.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("invite_codes_code_uidx").on(table.code),
    index("invite_codes_community_id_idx").on(table.communityId),
    check("invite_codes_use_count_nonnegative", sql`${table.useCount} >= 0`),
    check("invite_codes_max_uses_positive", sql`${table.maxUses} is null or ${table.maxUses} > 0`),
  ],
);

/**
 * 가입 승인 대기열입니다.
 * member_id 는 이미 있는 미가입 명부와 합칠 때 그 줄을 가리킵니다. 새 사람이면 비워 둡니다.
 */
export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    applicantUserId: uuid("applicant_user_id").references(() => users.id, { onDelete: "set null" }),
    applicantName: text("applicant_name").notNull(),
    applicantContact: text("applicant_contact"),
    denominationConfirmed: boolean("denomination_confirmed").notNull().default(false),
    status: approvalStatusEnum("status").notNull().default("PENDING"),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("approval_requests_community_id_idx").on(table.communityId),
    index("approval_requests_applicant_user_id_idx").on(table.applicantUserId),
    index("approval_requests_community_status_idx").on(table.communityId, table.status),
  ],
);

/** 모들 안에 올리는 글입니다. 공동체 번호는 모들을 통해 찾습니다. */
export const groupPosts = pgTable(
  "group_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => smallGroups.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    mediaUrls: jsonList("media_urls"),
    graceCount: integer("grace_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("group_posts_group_id_idx").on(table.groupId),
    index("group_posts_author_id_idx").on(table.authorId),
    check("group_posts_grace_nonnegative", sql`${table.graceCount} >= 0`),
  ],
);

/** 모들 사진첩입니다. 게시글과 따로 둡니다. */
export const groupAlbums = pgTable(
  "group_albums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => smallGroups.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    mediaUrls: jsonList("media_urls"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("group_albums_group_id_idx").on(table.groupId),
    index("group_albums_author_id_idx").on(table.authorId),
  ],
);

/** 주일 기별(주보)입니다. share_token 으로 공개 기별을 나눕니다. */
export const bulletins = pgTable(
  "bulletins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "cascade" }),
    worshipDate: date("worship_date").notNull(),
    /** 주보에서 읽은 예배 이름. 1부, 2부, 3부와 새벽·수요·금요·특별입니다. */
    serviceLabel: text("service_label").notNull().default(""),
    /** 주보에서 읽은 시각. 글에 시각이 없으면 그 예배 종류의 기본 시각입니다. */
    serviceTime: text("service_time").notNull().default(""),
    sermonTitle: text("sermon_title").notNull(),
    scriptureText: text("scripture_text").notNull(),
    preacher: text("preacher").notNull(),
    blocksJson: jsonValue("blocks_json"),
    isPublic: boolean("is_public").notNull().default(false),
    shareToken: text("share_token"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("bulletins_share_token_uidx").on(table.shareToken),
    index("bulletins_community_id_idx").on(table.communityId),
    index("bulletins_community_date_idx").on(table.communityId, table.worshipDate),
  ],
);

/** 출석을 받는 모임 한 번입니다. */
export const attendanceSessions = pgTable(
  "attendance_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    departmentType: departmentTypeEnum("department_type").notNull(),
    title: text("title").notNull(),
    sessionDate: date("session_date").notNull(),
    qrCheckinToken: text("qr_checkin_token").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("attendance_sessions_qr_checkin_token_uidx").on(table.qrCheckinToken),
    index("attendance_sessions_community_id_idx").on(table.communityId),
    index("attendance_sessions_community_date_idx").on(table.communityId, table.sessionDate),
  ],
);

/** 한 사람의 출석 결과입니다. 같은 모임에 같은 사람은 한 줄만 있습니다. */
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull(),
    checkMethod: checkMethodEnum("check_method").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("attendance_records_session_member_uidx").on(table.sessionId, table.memberId),
    index("attendance_records_member_id_idx").on(table.memberId),
  ],
);

/** 공동체 일정입니다. */
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    /** 비어 있으면 교회 일정입니다. 있으면 그 모들 식구만 봅니다. */
    groupId: uuid("group_id").references(() => smallGroups.id, { onDelete: "cascade" }),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    /** 주보를 읽어 만든 일정입니다. 주보를 지우면 함께 지워집니다. */
    bulletinId: uuid("bulletin_id").references(() => bulletins.id, { onDelete: "cascade" }),
    sourceKey: text("source_key"),
    category: calendarCategoryEnum("category").notNull(),
    isLeaderOnly: boolean("is_leader_only").notNull().default(false),
    googleEventId: text("google_event_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("calendar_events_community_id_idx").on(table.communityId),
    index("calendar_events_community_start_idx").on(table.communityId, table.startAt),
    index("calendar_events_group_id_idx").on(table.groupId),
    uniqueIndex("calendar_events_bulletin_source_uidx").on(table.bulletinId, table.sourceKey),
    check("calendar_events_time_order", sql`${table.endAt} >= ${table.startAt}`),
  ],
);

/** 하루 묵상 본문입니다. */
export const dailyQts = pgTable(
  "daily_qts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "cascade" }),
    qtDate: date("qt_date").notNull(),
    scriptureTitle: text("scripture_title").notNull(),
    scriptureBody: text("scripture_body").notNull(),
    questionsJson: jsonValue("questions_json"),
    sourceFileUrl: text("source_file_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("daily_qts_community_id_idx").on(table.communityId),
    index("daily_qts_community_date_idx").on(table.communityId, table.qtDate),
  ],
);

/** 한 사람이 남긴 묵상입니다. */
export const qtReflections = pgTable(
  "qt_reflections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    qtId: uuid("qt_id")
      .notNull()
      .references(() => dailyQts.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    answersJson: jsonValue("answers_json"),
    graceCount: integer("grace_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("qt_reflections_qt_id_idx").on(table.qtId),
    index("qt_reflections_member_id_idx").on(table.memberId),
    uniqueIndex("qt_reflections_qt_member_uidx").on(table.qtId, table.memberId),
    check("qt_reflections_grace_nonnegative", sql`${table.graceCount} >= 0`),
  ],
);

/** 묵상에 남긴 은혜입니다. 한 묵상에 한 사람은 한 번만 오릅니다. */
export const qtGraceReactions = pgTable(
  "qt_grace_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reflectionId: uuid("reflection_id")
      .notNull()
      .references(() => qtReflections.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("qt_grace_reactions_reflection_member_uidx").on(table.reflectionId, table.memberId),
    index("qt_grace_reactions_member_id_idx").on(table.memberId),
  ],
);

/** 기도 나눔 글입니다. */
export const prayerRequests = pgTable(
  "prayer_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => smallGroups.id, { onDelete: "set null" }),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    visibility: prayerVisibilityEnum("visibility").notNull().default("PUBLIC"),
    prayTogetherCount: integer("pray_together_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("prayer_requests_community_id_idx").on(table.communityId),
    index("prayer_requests_member_id_idx").on(table.memberId),
    index("prayer_requests_group_id_idx").on(table.groupId),
    check("prayer_requests_count_nonnegative", sql`${table.prayTogetherCount} >= 0`),
  ],
);

/** 함께 기도하기를 누른 기록입니다. 한 글에 한 사람은 한 번만 남깁니다. */
export const prayerReactions = pgTable(
  "prayer_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prayerRequestId: uuid("prayer_request_id")
      .notNull()
      .references(() => prayerRequests.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("prayer_reactions_request_member_uidx").on(table.prayerRequestId, table.memberId),
    index("prayer_reactions_member_id_idx").on(table.memberId),
  ],
);

/** 기도 글에 붙는 쪽지입니다. */
export const prayerLetters = pgTable(
  "prayer_letters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prayerRequestId: uuid("prayer_request_id")
      .notNull()
      .references(() => prayerRequests.id, { onDelete: "cascade" }),
    senderMemberId: uuid("sender_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    receiverMemberId: uuid("receiver_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("prayer_letters_prayer_request_id_idx").on(table.prayerRequestId),
    index("prayer_letters_sender_member_id_idx").on(table.senderMemberId),
    index("prayer_letters_receiver_member_id_idx").on(table.receiverMemberId),
  ],
);

/** 살림 항목입니다. */
export const financeCategories = pgTable(
  "finance_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    departmentOrEvent: text("department_or_event").notNull(),
    type: financeTypeEnum("type").notNull(),
    name: text("name").notNull(),
    budgetAmount: numeric("budget_amount", { precision: 14, scale: 0 }).notNull().default("0"),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("finance_categories_community_id_idx").on(table.communityId),
    check("finance_categories_budget_nonnegative", sql`${table.budgetAmount} >= 0`),
  ],
);

/** 들어온 돈과 나간 돈입니다. */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => financeCategories.id, { onDelete: "cascade" }),
    transactionDate: date("transaction_date").notNull(),
    type: financeTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 0 }).notNull(),
    description: text("description").notNull(),
    receiptImageUrls: jsonList("receipt_image_urls"),
    recordedBy: uuid("recorded_by").references(() => members.id, { onDelete: "set null" }),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("transactions_community_id_idx").on(table.communityId),
    index("transactions_category_id_idx").on(table.categoryId),
    index("transactions_recorded_by_idx").on(table.recordedBy),
    index("transactions_community_date_idx").on(table.communityId, table.transactionDate),
    check("transactions_amount_nonnegative", sql`${table.amount} >= 0`),
  ],
);

/** 설문입니다. */
export const surveys = pgTable(
  "surveys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    questionsJson: jsonValue("questions_json"),
    allowAnonymous: boolean("allow_anonymous").notNull().default(false),
    deadline: timestamp("deadline", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id").references(() => members.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("surveys_community_id_idx").on(table.communityId),
    index("surveys_created_by_member_id_idx").on(table.createdByMemberId),
  ],
);

/** 설문에 보낸 답입니다. 익명이면 구성원 번호가 비어 있습니다. */
export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    answersJson: jsonValue("answers_json"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("survey_responses_survey_id_idx").on(table.surveyId),
    index("survey_responses_member_id_idx").on(table.memberId),
  ],
);

/** 회의록입니다. */
export const meetingMinutes = pgTable(
  "meeting_minutes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "cascade" }),
    meetingDate: date("meeting_date").notNull(),
    attendees: jsonValue("attendees"),
    content: text("content").notNull(),
    attachmentUrls: jsonList("attachment_urls"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("meeting_minutes_community_id_idx").on(table.communityId)],
);

/** 행사 자료입니다. 날짜나 자료가 없으면 빈칸으로 둡니다. */
export const eventArchives = pgTable(
  "event_archives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    eventDate: date("event_date"),
    photoUrls: jsonList("photo_urls"),
    youtubeUrls: jsonList("youtube_urls"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("event_archives_community_id_idx").on(table.communityId)],
);

/** 퀴즈입니다. 예배가 끝난 시각부터 정한 분 동안만 풀 수 있습니다. */
export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    questionsJson: jsonValue("questions_json"),
    scoresJson: jsonValue("scores_json"),
    worshipEndedAt: timestamp("worship_ended_at", { withTimezone: true }),
    solveMinutes: integer("solve_minutes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("quizzes_community_id_idx").on(table.communityId)],
);

/** 그달 퀴즈 상품 이름입니다. 사역자가 적은 이름만 저장합니다. */
export const quizMonthPrizes = pgTable(
  "quiz_month_prizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(),
    prizeName: text("prize_name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("quiz_month_prizes_community_month_uidx").on(table.communityId, table.yearMonth)],
);

/** 토론 글입니다. 지금 예배드리는 교회 또는 지금 가는 모들 중 한곳에만 붙습니다. */
export const discussionPosts = pgTable(
  "discussion_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("discussion_posts_church_id_idx").on(table.churchId),
    index("discussion_posts_group_id_idx").on(table.groupId),
    index("discussion_posts_author_user_id_idx").on(table.authorUserId),
    check("discussion_posts_one_place", sql`(${table.churchId} is not null) <> (${table.groupId} is not null)`),
    check("discussion_posts_title_not_blank", sql`length(btrim(${table.title})) > 0`),
    check("discussion_posts_body_not_blank", sql`length(btrim(${table.body})) > 0`),
  ],
);

/** 토론 답글입니다. 승인 상태 없이 글 아래에 바로 붙습니다. */
export const discussionReplies = pgTable(
  "discussion_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => discussionPosts.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("discussion_replies_post_id_idx").on(table.postId),
    index("discussion_replies_author_user_id_idx").on(table.authorUserId),
    check("discussion_replies_body_not_blank", sql`length(btrim(${table.body})) > 0`),
  ],
);

/** 공동체마다 하나인 열린 안뜨레 설정입니다. */
export const websiteConfigs = pgTable(
  "website_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    themeJson: jsonObject("theme_json"),
    seoJson: jsonObject("seo_json"),
    blocksJson: jsonValue("blocks_json"),
    visitCount: integer("visit_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("website_configs_slug_uidx").on(table.slug),
    check("website_configs_visit_nonnegative", sql`${table.visitCount} >= 0`),
  ],
);

/**
 * 모들 편성 기록입니다.
 * 사람을 다른 모들로 옮겨도 지난 줄은 지우지 않고 끝난 시각만 적습니다.
 */
export const groupMemberships = pgTable(
  "group_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => smallGroups.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    seasonYear: integer("season_year").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("group_memberships_community_id_idx").on(table.communityId),
    index("group_memberships_group_id_idx").on(table.groupId),
    index("group_memberships_member_id_idx").on(table.memberId),
    uniqueIndex("group_memberships_open_member_uidx").on(table.memberId).where(sql`${table.endedAt} is null`),
  ],
);

/** 목사에게 묻는 질문입니다. 보이는 범위는 질문할 때 고릅니다. */
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    designatedPastorMemberId: uuid("designated_pastor_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    audience: questionAudienceEnum("audience").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("questions_community_id_idx").on(table.communityId),
    index("questions_author_user_id_idx").on(table.authorUserId),
    check("questions_body_not_blank", sql`length(btrim(${table.body})) > 0`),
  ],
);

/** 목사가 단 답글입니다. 승인 전에는 질문한 사람에게 보이지 않습니다. */
export const questionReplies = pgTable(
  "question_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    authorMemberId: uuid("author_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    status: questionReplyStatusEnum("status").notNull().default("PENDING"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("question_replies_community_id_idx").on(table.communityId),
    index("question_replies_question_id_idx").on(table.questionId),
    check("question_replies_body_not_blank", sql`length(btrim(${table.body})) > 0`),
  ],
);

/** 지도에 올린 교회입니다. 좌표는 주소 검색이 돌려준 값만 저장합니다. */
export const mapChurches = pgTable(
  "map_churches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    pastorName: text("pastor_name").notNull().default(""),
    address: text("address").notNull().default(""),
    phone: text("phone").notNull().default(""),
    serviceTime: text("service_time").notNull().default(""),
    memo: text("memo").notNull().default(""),
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    /** 통역 커뮤니티의 시/도. 모들에서는 제주만 두고, 모르면 비웁니다. */
    sido: text("sido"),
    /** 시군구. 제주시 또는 서귀포시만 두고, 주소가 애매하면 비웁니다. */
    district: text("district"),
    /** 시/도와 시군구를 붙인 지역 키. 예: 제주-제주시 */
    regionId: text("region_id"),
    /** 사람이 수정 화면에서 켠 태그입니다. 주소로 채우지 않습니다. */
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdByUserId: uuid("created_by_user_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    slug: text("slug"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("map_churches_community_id_idx").on(table.communityId),
    check("map_churches_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check(
      "map_churches_region_pair",
      sql`(
        (${table.sido} IS NULL AND ${table.district} IS NULL AND ${table.regionId} IS NULL)
        OR (
          ${table.sido} = '제주'
          AND ${table.district} IN ('제주시', '서귀포시')
          AND ${table.regionId} = ('제주-' || ${table.district})
        )
      )`,
    ),
  ],
);

/**
 * 모들 전체에서 글을 막을 때 쓰는 말입니다.
 * 사역자가 설정 화면에서 넣고 고치고 지웁니다. 코드에 단어를 고정하지 않습니다.
 */
export const bannedWords = pgTable(
  "banned_words",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    word: text("word").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("banned_words_word_uidx").on(table.word),
    check("banned_words_word_not_blank", sql`length(btrim(${table.word})) > 0`),
  ],
);

/** 안뜨레에 남긴 방문 문의입니다. */
export const websiteInquiries = pgTable(
  "website_inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    visitorName: text("visitor_name").notNull(),
    visitorContact: text("visitor_contact").notNull(),
    message: text("message").notNull(),
    isResolved: boolean("is_resolved").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("website_inquiries_community_id_idx").on(table.communityId)],
);

/** 예배 설정에서 언어마다 연결한 실시간 번역기 자막 주소입니다. */
export const worshipCaptionLinks = pgTable(
  "worship_caption_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    languageCode: text("language_code").notNull(),
    captionUrl: text("caption_url").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("worship_caption_links_community_language_uidx").on(table.communityId, table.languageCode),
    index("worship_caption_links_community_id_idx").on(table.communityId),
    check("worship_caption_links_url_https", sql`${table.captionUrl} like 'https://%'`),
  ],
);

/** 한 사람이 구독해 둔 교회입니다. */
export const churchFollows = pgTable(
  "church_follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    churchId: uuid("church_id")
      .notNull()
      .references(() => mapChurches.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("church_follows_user_church_uidx").on(table.userId, table.churchId),
    index("church_follows_user_id_idx").on(table.userId),
    index("church_follows_church_id_idx").on(table.churchId),
  ],
);

/** 한 사람이 골라 둔 모임입니다. */
export const groupFollows = pgTable(
  "group_follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => smallGroups.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("group_follows_user_group_uidx").on(table.userId, table.groupId),
    index("group_follows_user_id_idx").on(table.userId),
    index("group_follows_group_id_idx").on(table.groupId),
  ],
);

/** 교회 또는 모들 하나의 홍보 페이지입니다. 일정과 재정은 두지 않습니다. */
export const promoPages = pgTable(
  "promo_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id").references((): AnyPgColumn => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references((): AnyPgColumn => smallGroups.id, { onDelete: "cascade" }),
    instagram: text("instagram").notNull().default(""),
    intro: text("intro").notNull().default(""),
    youtubeJson: jsonValue("youtube_json"),
    tabsJson: jsonValue("tabs_json"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("promo_pages_church_uidx").on(table.churchId).where(sql`${table.churchId} is not null`),
    uniqueIndex("promo_pages_group_uidx").on(table.groupId).where(sql`${table.groupId} is not null`),
    check("promo_pages_one_place", sql`(${table.churchId} is not null) <> (${table.groupId} is not null)`),
  ],
);

/** 태우리가 소속원에게 준 재정·일정 수정 권한입니다. */
export const placeEditGrants = pgTable(
  "place_edit_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    churchId: uuid("church_id").references(() => mapChurches.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => smallGroups.id, { onDelete: "cascade" }),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("place_edit_grants_user_id_idx").on(table.userId),
    check("place_edit_grants_one_place", sql`(${table.churchId} is not null) <> (${table.groupId} is not null)`),
  ],
);

export const dbSchema = {
  users,
  oauthIdentities,
  oauthPending,
  sessions,
  communities,
  members,
  smallGroups,
  inviteCodes,
  approvalRequests,
  groupPosts,
  groupAlbums,
  bulletins,
  attendanceSessions,
  attendanceRecords,
  calendarEvents,
  dailyQts,
  qtReflections,
  qtGraceReactions,
  prayerRequests,
  prayerReactions,
  prayerLetters,
  financeCategories,
  transactions,
  surveys,
  surveyResponses,
  meetingMinutes,
  eventArchives,
  quizzes,
  quizMonthPrizes,
  discussionPosts,
  discussionReplies,
  websiteConfigs,
  websiteInquiries,
  groupMemberships,
  questions,
  questionReplies,
  mapChurches,
  churchFollows,
  groupFollows,
  placeEditGrants,
  promoPages,
  bannedWords,
  worshipCaptionLinks,
};
