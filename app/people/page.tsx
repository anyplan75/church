"use client";

import { useState } from "react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { useChurch, useClientQuery } from "@/components/church-state";
import { createPerson, deletePerson, updatePerson } from "@/lib/actions";
import { updateDb } from "@/lib/app-db";
import { readItemPhoto } from "@/lib/item-photo";
import { commitPeopleImport, planPeopleImport, readPeopleFile, type PeopleOverlap, type PeopleRow } from "@/lib/people-sheet";
import { isItemPhoto } from "@/lib/supplies";
import { OFFICES, PERSON_CATEGORIES, type Person } from "@/lib/types";

export default function PeoplePage() {
  const { ready, db } = useChurch();
  const query = useClientQuery();
  if (!ready || !db) return null;

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">사람</h1>
      <p className="mt-2 text-muted">구분은 사역자, 등록교인, 미등록교인입니다. 직분은 목사, 전도사, 장로, 안수집사, 서리집사, 권사입니다. 사진 칸은 이름 앞에 있습니다.</p>
      {query.error === "name" ? <p className="mt-4 text-sm text-wine">이름을 입력해 주세요.</p> : null}

      <PeopleExcel people={db.people} />

      <form action={createPerson} autoComplete="off" className="card mt-6 grid gap-3 p-5 md:grid-cols-2">
        <PersonFields />
        <div className="md:col-span-2">
          <SubmitButton>추가</SubmitButton>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {db.people.length === 0 ? <p className="text-muted">등록된 사람이 없습니다.</p> : null}
        {db.people.map((person) => (
          <form key={person.id} action={updatePerson} className="card grid gap-3 p-4 md:grid-cols-2">
            <input type="hidden" name="id" value={person.id} />
            <PersonFields person={person} />
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <SubmitButton className="btn btn-quiet">저장</SubmitButton>
              <ConfirmSubmit action={deletePerson} message={`${person.name} 님을 명단에서 지울까요?`} className="btn btn-quiet text-wine">
                삭제
              </ConfirmSubmit>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}

function PersonFields({ person }: { person?: Person }) {
  const [photo, setPhoto] = useState(person?.photo ?? "");
  const [photoError, setPhotoError] = useState("");
  return (
    <>
      <label className="field">
        <span>사진</span>
        {photo ? <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover" /> : null}
        <input type="hidden" name="photo" value={photo} />
        <input
          className="input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void readItemPhoto(file).then(
              (next) => {
                setPhoto(next);
                setPhotoError("");
              },
              (error: Error) => setPhotoError(error.message),
            );
          }}
        />
        {photoError ? <span className="text-sm text-wine">{photoError}</span> : null}
      </label>
      <label className="field">
        <span>이름</span>
        <input className="input" name="name" defaultValue={person?.name ?? ""} maxLength={40} required placeholder="이름" />
      </label>
      <label className="field">
        <span>구분</span>
        <select className="select" name="category" defaultValue={person?.category ?? "registered"}>
          {PERSON_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>직분</span>
        <select className="select" name="office" defaultValue={person?.office ?? ""}>
          <option value="">없음</option>
          {OFFICES.map((office) => (
            <option key={office} value={office}>
              {office}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>주소</span>
        <input className="input" name="address" defaultValue={person?.address ?? ""} maxLength={120} placeholder="주소" />
      </label>
      <label className="field">
        <span>전화번호</span>
        <input className="input" name="phone" defaultValue={person?.phone ?? ""} maxLength={30} placeholder="전화번호" />
      </label>
      <label className="field">
        <span>이메일</span>
        <input className="input" name="email" defaultValue={person?.email ?? ""} maxLength={120} placeholder="이메일" />
      </label>
      <label className="field md:col-span-2">
        <span>메모</span>
        <input className="input" name="memo" defaultValue={person?.memo ?? ""} maxLength={400} placeholder="메모" />
      </label>
    </>
  );
}

function PeopleExcel({ people }: { people: Person[] }) {
  const [rows, setRows] = useState<PeopleRow[]>([]);
  const [overlaps, setOverlaps] = useState<PeopleOverlap[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    setMessage("");
    setError("");
    setRows([]);
    setOverlaps([]);
    if (!file) return;
    try {
      const parsed = await readPeopleFile(file);
      const ready = await Promise.all(parsed.map(async (row) => ({ ...row, photo: await shrinkPhoto(row.photo) })));
      if (ready.length === 0) {
        setError("이름 칸이 있는 줄을 찾지 못했습니다. 첫 칸은 사진, 다음 칸은 이름입니다.");
        return;
      }
      const plan = planPeopleImport(people, ready);
      if (plan.overlaps.length === 0) {
        save(ready, "skip");
        return;
      }
      setRows(ready);
      setOverlaps(plan.overlaps);
    } catch {
      setError("엑셀 파일을 읽지 못했습니다. xlsx 또는 csv 파일을 올려 주세요.");
    }
  }

  function save(source: PeopleRow[], choice: "skip" | "update") {
    let result = { added: 0, updated: 0, skipped: 0 };
    updateDb((db) => {
      const next = commitPeopleImport(db.people, db.attendance, source, choice);
      db.people = next.people;
      db.attendance = next.attendance;
      result = { added: next.added, updated: next.updated, skipped: next.skipped };
    });
    setRows([]);
    setOverlaps([]);
    setMessage(`새 사람 ${result.added}명을 넣었습니다. 겹친 줄 ${result.skipped}개는 건너뛰고 ${result.updated}명은 기존 사람을 고쳤습니다.`);
  }

  return (
    <section className="card mt-6 space-y-3 p-5">
      <h2 className="font-serif text-2xl">엑셀로 넣기</h2>
      <p className="text-sm text-muted">칸 순서는 사진, 이름, 전화번호, 구분, 직분, 주소, 이메일, 메모입니다. 이름과 전화번호가 같으면 새로 만들지 않습니다.</p>
      <button type="button" className="btn btn-quiet btn-small" onClick={downloadTemplate}>
        양식 받기
      </button>
      <input
        className="input"
        type="file"
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      {error ? <p className="text-sm text-wine">{error}</p> : null}
      {message ? <p className="text-sm text-pine">{message}</p> : null}
      {overlaps.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-wine">겹치는 줄이 있습니다. 새로 만들지 않습니다.</p>
          <ul className="space-y-1 text-sm">
            {overlaps.map((overlap) => (
              <li key={overlap.row}>
                {overlap.row}줄 {overlap.name}
                {overlap.phone ? ` · ${overlap.phone}` : ""}
                {overlap.matchRow ? ` · ${overlap.matchRow}줄과 겹칩니다` : " · 이미 있는 사람과 겹칩니다"}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-quiet" onClick={() => save(rows, "skip")}>
              겹치는 줄 건너뛰기
            </button>
            <button type="button" className="btn btn-primary" onClick={() => save(rows, "update")}>
              기존 사람 고치기
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function downloadTemplate() {
  const csv = "\uFEFF사진,이름,전화번호,구분,직분,주소,이메일,메모\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "사람-양식.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function shrinkPhoto(photo: string): Promise<string> {
  if (!photo || isItemPhoto(photo)) return photo;
  try {
    const blob = await (await fetch(photo)).blob();
    if (!blob.type.startsWith("image/") || blob.size > 8 * 1024 * 1024) return "";
    return await readItemPhoto(new File([blob], "photo", { type: blob.type }));
  } catch {
    return "";
  }
}
