/**
 * 가입 승인과 모들 편성의 순수 규칙입니다.
 * 데이터베이스에 접속하지 않습니다.
 */

export type RosterCandidate = {
  id: string;
  userId: string | null;
  phone: string | null;
};

export type ApprovalPlan =
  | { kind: "merge"; memberId: string }
  | { kind: "create" }
  | { kind: "ambiguous" };

export type JoinCheck = {
  codeFound: boolean;
  expired: boolean;
  exhausted: boolean;
  denominationMatches: boolean;
  alreadyPending: boolean;
  alreadyMember: boolean;
};

/** 전화번호 비교용으로 숫자만 남깁니다. */
export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function denominationsMatch(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase("ko-KR") === right.trim().toLocaleLowerCase("ko-KR");
}

/** 가입을 막아야 하면 한국어 이유를, 아니면 null 을 돌려줍니다. */
export function explainJoinBlock(check: JoinCheck): string | null {
  if (!check.codeFound) return "초대 코드가 맞지 않습니다.";
  if (check.expired) return "초대 코드 기한이 지났습니다.";
  if (check.exhausted) return "초대 코드를 더 쓸 수 없습니다.";
  if (!check.denominationMatches) return "신청한 교단이 공동체 교단과 다릅니다.";
  if (check.alreadyMember) return "이미 이 공동체의 정식 구성원입니다.";
  if (check.alreadyPending) return "이미 승인을 기다리고 있습니다.";
  return null;
}

/**
 * 승인할 때 미가입 명부와 합칠지 결정합니다.
 * 같은 공동체에서 계정이 없고 전화번호가 같은 줄이 하나면 그 줄에 계정을 붙입니다.
 */
export function planApproval(members: readonly RosterCandidate[], phone: string): ApprovalPlan {
  const needle = normalizePhone(phone);
  if (!needle) return { kind: "create" };
  const matches = members.filter(
    (member) => member.userId == null && normalizePhone(member.phone) === needle,
  );
  if (matches.length === 1) return { kind: "merge", memberId: matches[0].id };
  if (matches.length > 1) return { kind: "ambiguous" };
  return { kind: "create" };
}

/** 새 해로 편성할 때 보관할 이전 모들 번호입니다. 줄 자체는 지우지 않습니다. */
export function groupIdsToArchive(
  groups: readonly { id: string; seasonYear: number; isArchived: boolean }[],
  nextYear: number,
): string[] {
  return groups
    .filter((group) => !group.isArchived && group.seasonYear !== nextYear)
    .map((group) => group.id);
}
