import { storedBackgroundUrl } from "./app-db";
import { captionFont, captionSize, fullscreenStep } from "./simple";
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
  mainFontSize: number;
  overlayFontSize: number;
  vertical: number;
};

export function emptyLiveView(serviceId: string): LiveView {
  return {
    serviceId,
    title: "",
    status: "",
    index: 0,
    total: 0,
    slide: null,
    overlay: "bottom",
    backgroundColor: "#1b3a32",
    backgroundUrl: null,
    fontFamily: captionFont(undefined).family,
    overlayFontFamily: captionFont(undefined).family,
    mainFontSize: captionSize(undefined),
    overlayFontSize: captionSize(undefined),
    vertical: fullscreenStep(undefined),
  };
}

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
    mainFontSize: captionSize(db.settings.mainFontSize),
    overlayFontSize: captionSize(db.settings.overlayFontSize),
    vertical: fullscreenStep(db.settings.fullscreenStep),
  };
}
