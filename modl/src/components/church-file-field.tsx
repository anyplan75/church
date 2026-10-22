"use client";

import { useState } from "react";

/** 브라우저 기본 영문 파일 단추 대신 한국어로 엑셀 파일을 고릅니다. */
export function ChurchFileField() {
  const [name, setName] = useState("");
  return (
    <label className="grid cursor-pointer gap-1">
      <span className="font-semibold">엑셀 파일</span>
      <input
        name="file"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        required
        className="sr-only"
        onChange={(event) => setName(event.target.files?.[0]?.name ?? "")}
      />
      <span className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 leading-snug">
        {name || "엑셀 파일을 고르세요"}
      </span>
    </label>
  );
}
