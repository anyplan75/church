"use client";

import { useState } from "react";
import { createService } from "@/lib/actions";
import { formatKoreanDate, formatTime } from "@/lib/format";
import { SERVICE_TYPES, type Person, type Service, type ServiceType } from "@/lib/types";
import { serviceTypeDefaults, templateItems } from "@/lib/worship";
import { SubmitButton } from "./submit-button";

export function NewServiceForm({
  initialDate,
  people,
  services,
}: {
  initialDate: string;
  people: Person[];
  services: Service[];
}) {
  const initial = serviceTypeDefaults("sunday-2");
  const [type, setType] = useState<ServiceType>("sunday-2");
  const [title, setTitle] = useState(initial.title);
  const [time, setTime] = useState(initial.time);
  const [titleTouched, setTitleTouched] = useState(false);
  const [timeTouched, setTimeTouched] = useState(false);
  const [orderSource, setOrderSource] = useState("template");
  const activePeople = people.filter((person) => person.active);
  const preview = templateItems(type).map((item) => item.title).join(" · ");

  function changeType(next: ServiceType) {
    const defaults = serviceTypeDefaults(next);
    setType(next);
    if (!titleTouched) setTitle(defaults.title);
    if (!timeTouched) setTime(defaults.time);
  }

  return (
    <form action={createService} className="card mt-6 space-y-4 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="field">
          <span>날짜</span>
          <input className="input" type="date" name="date" defaultValue={initialDate} required />
        </label>
        <label className="field">
          <span>시간</span>
          <input
            className="input"
            type="time"
            name="time"
            value={time}
            required
            onChange={(event) => {
              setTimeTouched(true);
              setTime(event.target.value);
            }}
          />
        </label>
        <label className="field">
          <span>종류</span>
          <select className="select" name="type" value={type} onChange={(event) => changeType(event.target.value as ServiceType)}>
            {SERVICE_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>장소</span>
          <input className="input" name="place" defaultValue="본당" maxLength={40} required />
        </label>
      </div>
      <label className="field">
        <span>예배 이름</span>
        <input
          className="input"
          name="title"
          value={title}
          maxLength={80}
          required
          onChange={(event) => {
            setTitleTouched(true);
            setTitle(event.target.value);
          }}
        />
      </label>
      <label className="field">
        <span>설교자</span>
        <select className="select" name="preacherId" defaultValue="">
          <option value="">나중에 정하기</option>
          {activePeople.map((person) => (
            <option key={person.id} value={person.id}>
              {person.roles[0] ? `${person.name} · ${person.roles[0]}` : person.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>순서</span>
        <select className="select" name="orderSource" value={orderSource} onChange={(event) => setOrderSource(event.target.value)}>
          <option value="template">기본 순서</option>
          <option value="empty">빈 순서로 시작</option>
          {services.map((service) => (
            <option key={service.id} value={`copy:${service.id}`}>
              {formatKoreanDate(service.date)} {formatTime(service.time)} {service.title} 복사
            </option>
          ))}
        </select>
      </label>
      {orderSource === "template" ? <p className="text-sm text-muted">{preview}</p> : null}
      <SubmitButton>예배 만들기</SubmitButton>
    </form>
  );
}
