import Link from "next/link";
import { askQuestionAction } from "@/server/questions/actions";
import { AUDIENCE_LABEL, type QuestionAudience } from "@/questions/rules";
import type { QuestionCard } from "@/server/questions/service";

const ANSWER_NOTE = {
  waiting: "답을 확인하고 있습니다.",
  arrived: "답이 도착했습니다.",
  none: "",
  hidden: "",
} as const;

function Wordmark() {
  return <p className="text-center text-[2.15rem] font-bold leading-none tracking-[-0.045em] text-[#0f172a]">모들</p>;
}

function SendMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function QuestionComposer({
  canAsk,
  pastors,
}: {
  canAsk: boolean;
  pastors: { id: string; name: string }[];
}) {
  if (!canAsk) {
    return (
      <div className="grid justify-items-center gap-8">
        <Wordmark />
        <div className="relative w-full rounded-2xl border border-[#cbd5e1] bg-white">
          <p className="min-h-32 px-4 pb-14 pt-4 text-base leading-6 text-[#94a3b8]">로그인하면 질문할 수 있습니다.</p>
          <Link
            href="/account"
            className="absolute bottom-3 right-3 inline-flex h-9 items-center rounded-[10px] bg-[#e2e8f0] px-3 text-sm font-medium text-[#334155]"
          >
            로그인
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={askQuestionAction} id="question-form" className="grid justify-items-center gap-8">
      <Wordmark />
      <div className="grid w-full gap-4">
        <div className="relative rounded-2xl border border-[#cbd5e1] bg-white">
          <label className="sr-only" htmlFor="question-body">
            질문
          </label>
          <textarea
            id="question-body"
            name="body"
            required
            rows={4}
            placeholder="물어볼 내용을 적어 주세요"
            className="min-h-32 w-full resize-none border-0 bg-transparent px-4 pb-14 pt-4 text-base leading-6 text-[#1e293b] outline-none placeholder:text-[#94a3b8]"
          />
          <button
            type="submit"
            aria-label="질문하기"
            className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#e2e8f0] text-[#64748b] hover:bg-[#cbd5e1]"
          >
            <SendMark />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex">
            <span className="sr-only">목사</span>
            <select
              name="pastorMemberId"
              className="h-8 rounded-full border border-[#cbd5e1] bg-white px-3 text-sm font-medium text-[#475569]"
            >
              <option value="">목사 지정 안 함</option>
              {pastors.map((pastor) => (
                <option key={pastor.id} value={pastor.id}>
                  {pastor.name}
                </option>
              ))}
            </select>
          </label>
          {(Object.keys(AUDIENCE_LABEL) as QuestionAudience[]).map((audience) => (
            <label
              key={audience}
              className="inline-flex h-8 cursor-pointer items-center rounded-full border border-[#cbd5e1] bg-white px-3 text-sm font-medium text-[#475569] has-[:checked]:border-[#94a3b8] has-[:checked]:bg-[#f1f5f9] has-[:checked]:text-[#0f172a]"
            >
              <input type="radio" name="audience" value={audience} required className="sr-only" />
              {AUDIENCE_LABEL[audience]}
            </label>
          ))}
        </div>
        <p className="text-sm leading-5 text-[#64748b]">답은 목사가 씁니다. 승인 후에 질문한 사람에게만 보입니다.</p>
      </div>
    </form>
  );
}

export function QuestionList({ questions }: { questions: QuestionCard[] }) {
  if (questions.length === 0) {
    return <p className="text-center text-sm leading-5 text-[#94a3b8]">아직 보이는 질문이 없습니다.</p>;
  }
  return (
    <ul className="grid list-none gap-3">
      {questions.map((question) => (
        <li key={question.id}>
          <Link
            href={`/question/${question.id}`}
            className="grid gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-4 leading-6"
          >
            <span className="whitespace-pre-wrap break-words text-[15px] font-medium text-[#1e293b]">{question.body}</span>
            <span className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-medium text-[#475569]">
                {AUDIENCE_LABEL[question.audience]}
              </span>
              {question.pastorName ? (
                <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-medium text-[#475569]">{question.pastorName}</span>
              ) : null}
            </span>
            {ANSWER_NOTE[question.answerState] ? (
              <span className="text-sm text-[#64748b]">{ANSWER_NOTE[question.answerState]}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
