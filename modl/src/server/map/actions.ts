"use server";

import { z } from "zod";
import type { BusGuide } from "@/map/jeju-bus";
import type { MapPoint, PlaceHit, RouteResult, SnapResult } from "@/map/rules";
import { busRouteLine, guideBus } from "@/server/map/jeju-bus";
import { routeOnMapbox, type MapboxTravel } from "@/server/map/mapbox";
import { MapServiceError, routeBetween, searchPlaces, snapToRoad } from "@/server/map/service";

const pointSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});

export type MapAction<T> = { ok: true; data: T } | { ok: false; message: string };

function fail(error: unknown): MapAction<never> {
  if (error instanceof MapServiceError || error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: "지도 작업을 마치지 못했습니다." };
}

export async function searchPlacesAction(query: string): Promise<MapAction<PlaceHit[]>> {
  try {
    return { ok: true, data: await searchPlaces(query) };
  } catch (error) {
    return fail(error);
  }
}

export async function snapToRoadAction(points: MapPoint[]): Promise<MapAction<SnapResult>> {
  const parsed = z.array(pointSchema).max(20).safeParse(points);
  if (!parsed.success) return { ok: false, message: "점 위치를 확인해 주세요." };
  try {
    return { ok: true, data: await snapToRoad(parsed.data) };
  } catch (error) {
    return fail(error);
  }
}

export async function routeBetweenAction(start: MapPoint, end: MapPoint): Promise<MapAction<RouteResult>> {
  const parsed = z.object({ start: pointSchema, end: pointSchema }).safeParse({ start, end });
  if (!parsed.success) return { ok: false, message: "시작과 끝을 확인해 주세요." };
  try {
    return { ok: true, data: await routeBetween(parsed.data.start, parsed.data.end) };
  } catch (error) {
    return fail(error);
  }
}

export async function travelAction(start: MapPoint, end: MapPoint, mode: MapboxTravel): Promise<MapAction<RouteResult>> {
  const parsed = z
    .object({ start: pointSchema, end: pointSchema, mode: z.enum(["car", "walk"]) })
    .safeParse({ start, end, mode });
  if (!parsed.success) return { ok: false, message: "시작과 끝을 확인해 주세요." };
  try {
    return { ok: true, data: await routeOnMapbox(parsed.data.start, parsed.data.end, parsed.data.mode) };
  } catch (error) {
    return fail(error);
  }
}

export async function busRouteLineAction(routeId: string): Promise<MapAction<MapPoint[]>> {
  if (!/^[0-9]+$/.test(routeId)) return { ok: false, message: "노선 번호를 확인해 주세요." };
  try {
    return { ok: true, data: await busRouteLine(routeId) };
  } catch (error) {
    return fail(error);
  }
}

export async function busGuideAction(point: MapPoint): Promise<MapAction<BusGuide>> {
  const parsed = pointSchema.safeParse(point);
  if (!parsed.success) return { ok: false, message: "장소 위치를 확인해 주세요." };
  try {
    return { ok: true, data: await guideBus(parsed.data) };
  } catch (error) {
    return fail(error);
  }
}
