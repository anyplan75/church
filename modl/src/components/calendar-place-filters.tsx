"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { schedulePlaceColor } from "@/calendar/rules";
import { choiceButtonClass, choiceButtonStyle, choiceRowClass } from "@/components/choice-buttons";

type PlaceButton = { id: string; name: string; kind: "church" | "gathering" };

function placeKey(place: PlaceButton): string {
  return `${place.kind}:${place.id}`;
}

/** 일정 위의 교회·모들 버튼입니다. 누르면 그 일정이 보이고, 다시 누르면 숨습니다. */
export function CalendarPlaceFilters({ places, children }: { places: readonly PlaceButton[]; children: ReactNode }) {
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());

  useLayoutEffect(() => {
    const root = document.querySelector("[data-calendar-board]");
    if (!root) return;
    const known = new Set(places.map(placeKey));
    root.querySelectorAll<HTMLElement>("[data-schedule-place]").forEach((node) => {
      const key = node.dataset.schedulePlace ?? "";
      node.hidden = Boolean(key) && known.has(key) && !shown.has(key);
    });
  }, [places, shown, children]);

  function toggle(key: string) {
    setShown((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="grid min-w-0 gap-4">
      {places.length > 0 ? (
        <div data-testid="calendar-place-filters" className={choiceRowClass}>
          {places.map((place) => {
            const key = placeKey(place);
            const on = shown.has(key);
            const color = schedulePlaceColor(place.kind, place.id);
            return (
              <button
                key={key}
                type="button"
                data-testid="calendar-place-filter"
                data-kind={place.kind}
                data-on={on ? "yes" : "no"}
                aria-pressed={on}
                onClick={() => toggle(key)}
                className={choiceButtonClass}
                style={choiceButtonStyle(on, color)}
              >
                {place.name}
              </button>
            );
          })}
        </div>
      ) : null}
      <div data-calendar-board className="min-w-0">
        {children}
      </div>
    </div>
  );
}
