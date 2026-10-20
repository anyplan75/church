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

export function QuestionComposer({
  canAsk,
  pastors,
}: {
  canAsk: boolean;
  pastors: { id: string; name: string }[];
}) {
  if (!canAsk) {
    return (
      <section className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h1 className="text-[clamp(1.35rem,1.1rem+0.6vw,1.8rem)] font-semibold leading-tight">질문</h1>
        <p className="leading-relaxed">로그인하면 목사에게 질문할 수 있습니다.</p>
        <Link href="/account" className="inline-flex w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
          계정
        </Link>
      </section>
    );
  }

  return (
    <form action={askQuestionAction} id="question-form" className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
      <h1 className="text-[clamp(1.35rem,1.1rem+0.6vw,1.8rem)] font-semibold leading-tight">질문</h1>
      <label className="grid gap-1">
        <span className="font-semibold">무엇을 물을까요?</span>
        <textarea
          name="body"
          required
          rows={4}
          className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 leading-relaxed"
        />
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">목사</span>
        <select name="pastorMemberId" className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 leading-snug">
          <option value="">지정하지 않음</option>
          {pastors.map((pastor) => (
            <option key={pastor.id} value={pastor.id}>
              {pastor.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-2">
        <legend className="font-semibold">보이는 곳</legend>
        {(Object.keys(AUDIENCE_LABEL) as QuestionAudience[]).map((audience) => (
          <label key={audience} className="flex items-center gap-2 leading-snug">
            <input type="radio" name="audience" value={audience} required />
            <span>{AUDIENCE_LABEL[audience]}</span>
          </label>
        ))}
      </fieldset>
      <p className="leading-relaxed text-[#4b5563]">답은 목사가 씁니다. 승인 후에 질문한 사람에게만 보입니다.</p>
      <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
        질문하기
      </button>
    </form>
  );
}

export function QuestionList({ questions }: { questions: QuestionCard[] }) {
  if (questions.length === 0) {
    return <p className="leading-relaxed text-[#4b5563]">아직 보이는 질문이 없습니다.</p>;
  }
  return (
    <ul className="grid list-none gap-3">
      {questions.map((question) => (
        <li key={question.id}>
          <Link
            href={`/question/${question.id}`}
            className="grid gap-2 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm leading-relaxed"
          >
            <span className="whitespace-pre-wrap break-words font-semibold">{question.body}</span>
            <span className="flex flex-wrap gap-2 text-[#4b5563]">
              <span className="rounded-full bg-[#f3f4f6] px-3 py-1">{AUDIENCE_LABEL[question.audience]}</span>
              {question.pastorName ? <span className="rounded-full bg-[#f3f4f6] px-3 py-1">{question.pastorName}</span> : null}
            </span>
            {ANSWER_NOTE[question.answerState] ? <span>{ANSWER_NOTE[question.answerState]}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
