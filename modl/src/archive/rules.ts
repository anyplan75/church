/**
 * 행사 영상의 재생 주소와 퀴즈 점수입니다.
 * 데이터베이스에 접속하지 않습니다.
 */

export type QuizQuestion = {
  prompt: string;
  choices: string[];
  answerIndex: number;
};

export type PublicQuizQuestion = {
  prompt: string;
  choices: string[];
};

export type QuizScore = {
  memberId: string;
  score: number;
  total: number;
  submittedAt: string;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,}$/;

/** 유튜브 시청 주소를 영상 칸 주소로 바꿉니다. 다른 사이트는 받지 않습니다. */
export function youtubeEmbedUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let id = "";
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter((part) => part.length > 0)[0] ?? "";
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
    else if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] ?? "";
    else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] ?? "";
  } else {
    return null;
  }
  if (!YOUTUBE_ID.test(id)) return null;
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

/** 한 줄은 `질문|보기|보기|정답번호` 입니다. 정답 번호는 1부터 셉니다. */
export function parseQuizLines(raw: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  for (const line of lines) {
    const parts = line.split("|").map((part) => part.trim());
    if (parts.length < 4) {
      throw new Error("퀴즈 줄은 질문|보기|보기|정답번호 로 적어 주세요.");
    }
    const answerNumber = Number(parts[parts.length - 1]);
    const choices = parts.slice(1, -1);
    const prompt = parts[0] ?? "";
    if (!prompt || choices.some((choice) => choice.length === 0)) {
      throw new Error("질문과 보기를 모두 적어 주세요.");
    }
    if (!Number.isInteger(answerNumber) || answerNumber < 1 || answerNumber > choices.length) {
      throw new Error("정답 번호는 보기 안에서 1부터 셉니다.");
    }
    questions.push({ prompt, choices, answerIndex: answerNumber - 1 });
  }
  if (questions.length === 0) {
    throw new Error("퀴즈 질문을 한 줄 이상 적어 주세요.");
  }
  return questions;
}

/** 푸는 화면에는 정답 번호를 넣지 않습니다. */
export function publicQuizQuestions(questions: readonly QuizQuestion[]): PublicQuizQuestion[] {
  return questions.map((question) => ({ prompt: question.prompt, choices: [...question.choices] }));
}

/** 고른 번호가 정답 번호와 같은 개수를 셉니다. 비어 있으면 틀립니다. */
export function scoreQuiz(questions: readonly QuizQuestion[], answers: readonly number[]): { score: number; total: number } {
  let score = 0;
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question) continue;
    if (answers[index] === question.answerIndex) score += 1;
  }
  return { score, total: questions.length };
}

/** 같은 사람의 이전 점수는 새 점수로 바꿉니다. */
export function replaceMemberScore(scores: readonly QuizScore[], next: QuizScore): QuizScore[] {
  return [...scores.filter((item) => item.memberId !== next.memberId), next];
}

export type QuizWindow = "open" | "closed";

/** 예배가 끝난 시각부터 정한 분까지가 푸는 시간입니다. 시각이 없으면 풀 수 없습니다. */
export function quizWindow(input: {
  worshipEndedAt: Date | null;
  solveMinutes: number | null;
  now: Date;
}): QuizWindow {
  if (!input.worshipEndedAt || input.solveMinutes === null || !Number.isInteger(input.solveMinutes) || input.solveMinutes <= 0) {
    return "closed";
  }
  const start = input.worshipEndedAt.getTime();
  if (Number.isNaN(start)) return "closed";
  const end = start + input.solveMinutes * 60_000;
  const now = input.now.getTime();
  if (now >= start && now <= end) return "open";
  return "closed";
}

/** 서울 달력의 해-달입니다. */
export function monthKey(date: Date, timeZone = "Asia/Seoul"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(date);
  return parts.slice(0, 7);
}

export type QuizKingEntry = {
  memberId: string;
  correct: number;
  firstSubmittedAt: string;
};

/** 맞힌 수가 가장 많은 사람입니다. 같으면 먼저 제출한 사람입니다. 기록이 없으면 없습니다. */
export function pickQuizKing(entries: readonly QuizKingEntry[]): QuizKingEntry | null {
  const byMember = new Map<string, QuizKingEntry>();
  for (const entry of entries) {
    if (!Number.isInteger(entry.correct) || entry.correct < 0) continue;
    const current = byMember.get(entry.memberId);
    if (!current) {
      byMember.set(entry.memberId, { ...entry });
      continue;
    }
    current.correct += entry.correct;
    if (entry.firstSubmittedAt < current.firstSubmittedAt) current.firstSubmittedAt = entry.firstSubmittedAt;
  }
  let winner: QuizKingEntry | null = null;
  for (const entry of byMember.values()) {
    if (!winner) {
      winner = entry;
      continue;
    }
    if (entry.correct > winner.correct) winner = entry;
    else if (entry.correct === winner.correct && entry.firstSubmittedAt < winner.firstSubmittedAt) winner = entry;
  }
  return winner;
}

export type ArchivePlace = { churchId: string | null; groupId: string | null };

/**
 * 체크한 교회와 모들마다 자료를 올립니다.
 * 하나도 고르지 않으면 저장하지 않습니다. 속하지 않은 곳은 받지 않습니다.
 */
export function archiveTargets(input: {
  churchIds: readonly string[];
  gatheringIds: readonly string[];
  allowedChurchIds: ReadonlySet<string>;
  allowedGatheringIds: ReadonlySet<string>;
}): { ok: true; places: ArchivePlace[] } | { ok: false; message: string } {
  const churches = [...new Set(input.churchIds.map((id) => id.trim()).filter(Boolean))];
  const gatherings = [...new Set(input.gatheringIds.map((id) => id.trim()).filter(Boolean))];
  if (churches.length === 0 && gatherings.length === 0) {
    return { ok: false, message: "자료를 올릴 곳을 골라 주세요." };
  }
  if (churches.some((id) => !input.allowedChurchIds.has(id))) {
    return { ok: false, message: "속한 교회만 고를 수 있습니다." };
  }
  if (gatherings.some((id) => !input.allowedGatheringIds.has(id))) {
    return { ok: false, message: "속한 모들만 고를 수 있습니다." };
  }
  return {
    ok: true,
    places: [
      ...churches.map((churchId) => ({ churchId, groupId: null })),
      ...gatherings.map((groupId) => ({ churchId: null, groupId })),
    ],
  };
}

/** 목록에 붙일 교회 이름과 모들 이름입니다. */
export function archiveScopeLabel(input: { churchName: string | null; gatheringName: string | null }): string {
  if (input.churchName && input.gatheringName) return `교회 · ${input.churchName} · 모들 · ${input.gatheringName}`;
  if (input.churchName) return `교회 · ${input.churchName}`;
  if (input.gatheringName) return `모들 · ${input.gatheringName}`;
  return "";
}

/** 구독한 교회 자료와 구독한 모들 자료만 보입니다. 교회와 모들이 비어 있으면 전체에 보이지 않습니다. */
export function canSeeArchive(
  row: { churchId: string | null; groupId: string | null },
  followedChurchIds: ReadonlySet<string>,
  followedGroupIds: ReadonlySet<string>,
): boolean {
  if (row.churchId && followedChurchIds.has(row.churchId)) return true;
  if (row.groupId && followedGroupIds.has(row.groupId)) return true;
  return false;
}

/** 주소 칸에 한 줄씩 적은 값을 목록으로 만듭니다. */
export function linkLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
