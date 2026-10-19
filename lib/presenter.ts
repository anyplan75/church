import type { DeskSlide } from "./slide-show";
import type { Service } from "./types";
import { nextService, splitServices } from "./worship";

/** 프레젠터에 올릴 예배 후보(예정·진행 중). */
export function presenterServiceChoices(services: Service[], today: string): Service[] {
  return splitServices(services, today).upcoming;
}

/**
 * 고른 예배 id를 확정합니다.
 * 없거나 목록에 없으면 진행 중·다음 예배로 잡습니다.
 */
export function resolvePresenterServiceId(services: Service[], pickedId: string, today: string): string {
  const clean = String(pickedId ?? "").trim();
  if (clean && services.some((service) => service.id === clean)) return clean;
  return nextService(services, today)?.id ?? "";
}

/** 현재 flat 기준으로 이전·현재·다음 슬라이드를 찾습니다. */
export function neighborSlides(
  slides: DeskSlide[],
  flat: number,
): { prev?: DeskSlide; current?: DeskSlide; next?: DeskSlide } {
  if (slides.length === 0) return {};
  const current = slides.find((slide) => slide.flat === flat) ?? slides[0];
  if (!current) return {};
  return {
    prev: current.flat > 0 ? slides[current.flat - 1] : undefined,
    current,
    next: slides[current.flat + 1],
  };
}

/** 송출·라이브 큐에 넘길 점프 값으로 바꿉니다. */
export function cueFromSlide(slide: DeskSlide): { groupIndex: number; inGroup: number; lines: string[] } {
  return {
    groupIndex: slide.groupIndex,
    inGroup: slide.inGroup,
    lines: slide.lines.slice(),
  };
}

/** 프레젠터 주소에 예배 id를 붙이거나 뗍니다. */
export function presenterHref(serviceId = ""): string {
  const id = String(serviceId ?? "").trim();
  return id ? `/presenter/?service=${encodeURIComponent(id)}` : "/presenter/";
}
