"use client";

import { useEffect, useState } from "react";
import { refreshSurveyDeskAction } from "@/server/survey/actions";
import type { SurveyDesk } from "@/server/survey/service";

/** 설정 화면이 열려 있는 동안 저장된 응답만 다시 읽습니다. */
export function SurveyDeskLive({ initial }: { initial: SurveyDesk }) {
  const [desk, setDesk] = useState(initial);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshSurveyDeskAction().then((next) => {
        if (next) setDesk(next);
      });
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  if (desk.surveys.length === 0) {
    return <p className="leading-relaxed">아직 설문이 없습니다.</p>;
  }

  return (
    <ul className="grid list-none gap-3">
      {desk.surveys.map((survey) => (
        <li key={survey.id} className="grid gap-2 rounded-2xl border border-[#e5e7eb] bg-white p-4">
          <p className="break-words font-semibold">{survey.title}</p>
          {survey.responses.length === 0 ? (
            <p className="leading-relaxed text-[#5c5148]">아직 응답이 없습니다.</p>
          ) : (
            <ul className="grid list-none gap-2">
              {survey.responses.map((response) => (
                <li key={response.id} className="grid gap-1 rounded-xl bg-[#fffaf3] px-3 py-2 leading-snug">
                  <span className="font-semibold">{response.authorName ? response.authorName : "이름 없이"}</span>
                  {response.answers.map((answer, index) => (
                    <p key={`${response.id}-${index}`} className="break-words">
                      {index + 1}. {answer}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
