import { storedBackgroundUrl } from "./app-db";
import { captionFont, fullscreenStep } from "./simple";
import type { Db } from "./types";
import { clampLiveIndex } from "./worship";
import { slidesFor, type Slide } from "./slides";

export type LiveView = {
  serviceId: string;
  title: string;
  status: string;
  index: number;
  total: number;
  slide: Slide | null;
  overlay: Db["settings"]["overlay"];
  backgroundColor: string;
  backgroundUrl: string | null;
  fontFamily: string;
  overlayFontFamily: string;
  vertical: number;
};

export function liveView(db: Db, serviceId: string): LiveView | null {
  const service = db.services.find((item) => item.id === serviceId);
  if (!service) return null;
  const slides = slidesFor(service, db.people, db.songs);
  const index = clampLiveIndex(service.liveIndex, slides.length);
  return {
    serviceId,
    title: service.title,
    status: service.status,
    index,
    total: slides.length,
    slide: slides[index] ?? null,
    overlay: db.settings.overlay,
    backgroundColor: db.settings.backgroundColor || "#1b3a32",
    backgroundUrl: storedBackgroundUrl(db.settings.backgroundFile),
    fontFamily: captionFont(db.settings.fullscreenFont).family,
    overlayFontFamily: captionFont(db.settings.overlayFont).family,
    vertical: fullscreenStep(db.settings.fullscreenStep),
  };
}
