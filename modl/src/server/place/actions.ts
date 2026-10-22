"use server";

import { redirect } from "next/navigation";
import {
  assignSteward,
  createGathering,
  grantPlaceEdit,
  readablePlaceError,
  revokePlaceEdit,
  setCurrentChurch,
  setCurrentGathering,
  subscribeChurch,
  subscribeGathering,
  unsubscribeChurch,
  unsubscribeGathering,
} from "@/server/place/service";
import type { PlaceKind } from "@/place/rules";

function fail(error: unknown): never {
  redirect(`/account?error=${encodeURIComponent(readablePlaceError(error))}`);
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function kindOf(value: string): PlaceKind {
  return value === "gathering" ? "gathering" : "church";
}

export async function subscribeChurchAction(formData: FormData) {
  try {
    await subscribeChurch(text(formData, "churchId"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=church-follow");
}

export async function setCurrentChurchAction(formData: FormData) {
  try {
    await setCurrentChurch(text(formData, "churchId"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=church-current");
}

export async function unsubscribeChurchAction(formData: FormData) {
  try {
    await unsubscribeChurch(text(formData, "churchId"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=church-left");
}

export async function createGatheringAction(formData: FormData) {
  try {
    await createGathering({ name: text(formData, "name"), address: text(formData, "address") });
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=gathering");
}

export async function subscribeGatheringAction(formData: FormData) {
  try {
    await subscribeGathering(text(formData, "groupId"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=gathering-follow");
}

export async function setCurrentGatheringAction(formData: FormData) {
  try {
    await setCurrentGathering(text(formData, "groupId"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=gathering-current");
}

export async function unsubscribeGatheringAction(formData: FormData) {
  try {
    await unsubscribeGathering(text(formData, "groupId"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=gathering-left");
}

export async function grantPlaceEditAction(formData: FormData) {
  try {
    await grantPlaceEdit(kindOf(text(formData, "kind")), text(formData, "placeId"), text(formData, "userId"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=grant");
}

export async function revokePlaceEditAction(formData: FormData) {
  try {
    await revokePlaceEdit(text(formData, "grantId"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=revoke");
}

export async function assignStewardAction(formData: FormData) {
  try {
    await assignSteward(kindOf(text(formData, "kind")), text(formData, "placeId"), text(formData, "email"));
  } catch (error) {
    fail(error);
  }
  redirect("/account?ok=steward");
}
