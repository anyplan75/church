"use client";

import { useLayoutEffect, useState } from "react";
import { schedulePlaceColor } from "@/calendar/rules";
import { CHOICE_ALL, CHOICE_REGION, choiceButtonClass, choiceButtonStyle, choiceRowClass } from "@/components/choice-buttons";

type NamedPlace = { id: string; name: string };

type Broad = "all" | "jeju_city" | "seogwipo";

const BROAD_BUTTONS: ReadonlyArray<{ id: Broad; label: string; color: string }> = [
  { id: "all", label: "전체", color: CHOICE_ALL },
  { id: "jeju_city", label: "제주시", color: CHOICE_REGION },
  { id: "seogwipo", label: "서귀포시", color: CHOICE_REGION },
];

function placeKey(kind: "church" | "gathering", id: string): string {
  return `${kind}:${id}`;
}

/**
 * 토론과 기도가 같이 쓰는 범위입니다.
 * 전체·제주시·서귀포시 중 하나만 켜지고, 교회와 모들은 여러 개를 고릅니다.
 * 한쪽을 켜면 다른 쪽은 꺼집니다.
 */
export function BelongingScopes({
  churches,
  gatherings,
  testId,
  itemTestId,
  boardId,
  anonymousWhenBroad = false,
}: {
  churches: readonly NamedPlace[];
  gatherings: readonly NamedPlace[];
  testId: string;
  itemTestId: string;
  boardId: string;
  anonymousWhenBroad?: boolean;
}) {
  const [broad, setBroad] = useState<Broad | null>("all");
  const [places, setPlaces] = useState<ReadonlySet<string>>(() => new Set());

  useLayoutEffect(() => {
    const root = document.querySelector(`[data-scope-board="${boardId}"]`);
    if (!root) return;
    const allowed = new Set<string>();
    if (broad) allowed.add(broad);
    for (const key of places) allowed.add(key);
    root.querySelectorAll<HTMLElement>("[data-scope-key]").forEach((node) => {
      const key = node.dataset.scopeKey ?? "";
      node.hidden = key.length > 0 && !allowed.has(key);
    });
  }, [boardId, broad, places]);

  function selectBroad(next: Broad) {
    setBroad(next);
    setPlaces(new Set());
  }

  function togglePlace(key: string) {
    setPlaces((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setBroad(next.size === 0 ? "all" : null);
      return next;
    });
  }

  const refs = broad ? [`${broad}:${broad}`] : [...places];

  return (
    <div className="grid gap-2">
      <div data-testid={testId} className={choiceRowClass}>
        {BROAD_BUTTONS.map((item) => {
          const on = broad === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={itemTestId}
              data-kind={item.id}
              data-on={on ? "yes" : "no"}
              aria-pressed={on}
              className={choiceButtonClass}
              style={choiceButtonStyle(on, item.color)}
              onClick={() => selectBroad(item.id)}
            >
              {item.label}
            </button>
          );
        })}
        {churches.map((church) => {
          const key = placeKey("church", church.id);
          const on = places.has(key);
          return (
            <button
              key={key}
              type="button"
              data-testid={itemTestId}
              data-kind="church"
              data-on={on ? "yes" : "no"}
              aria-pressed={on}
              className={choiceButtonClass}
              style={choiceButtonStyle(on, schedulePlaceColor("church", church.id))}
              onClick={() => togglePlace(key)}
            >
              {church.name}
            </button>
          );
        })}
        {gatherings.map((gathering) => {
          const key = placeKey("gathering", gathering.id);
          const on = places.has(key);
          return (
            <button
              key={key}
              type="button"
              data-testid={itemTestId}
              data-kind="gathering"
              data-on={on ? "yes" : "no"}
              aria-pressed={on}
              className={choiceButtonClass}
              style={choiceButtonStyle(on, schedulePlaceColor("gathering", gathering.id))}
              onClick={() => togglePlace(key)}
            >
              {gathering.name}
            </button>
          );
        })}
      </div>
      {refs.map((ref) => (
        <input key={ref} type="hidden" name="placeRef" value={ref} data-testid="scope-place-ref" />
      ))}
      {anonymousWhenBroad && broad ? (
        <label className="flex items-center gap-2 leading-snug">
          <input type="checkbox" name="anonymous" value="1" data-testid="discussion-anonymous" />
          익명으로 올리기
        </label>
      ) : null}
    </div>
  );
}
