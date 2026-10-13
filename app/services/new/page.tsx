"use client";

import { NewServiceForm } from "@/components/new-service-form";
import { useChurch, useClientQuery } from "@/components/church-state";
import { comingSunday, compareService, isISODate, todayISO } from "@/lib/worship";

export default function NewServicePage() {
  const { ready, db } = useChurch();
  const query = useClientQuery();
  if (!ready || !db) return null;
  const today = todayISO();
  const initialDate = query.date && isISODate(query.date) ? query.date : comingSunday(today);
  const services = db.services.slice().sort((a, b) => compareService(b, a));

  return (
    <div className="page max-w-3xl">
      <h1 className="font-serif text-4xl">예배 만들기</h1>
      <p className="mt-2 text-muted">날짜와 종류를 정하면 기본 순서가 들어갑니다. 지난 예배 순서를 그대로 가져올 수도 있습니다.</p>
      <NewServiceForm initialDate={initialDate} people={db.people} services={services} />
    </div>
  );
}
