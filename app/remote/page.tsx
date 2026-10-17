"use client";

import { MobileSlideRemote } from "@/components/mobile-slide-remote";
import { useClientQuery } from "@/components/church-state";

export default function RemotePage() {
  const query = useClientQuery();
  const serviceId = typeof query.id === "string" ? query.id : "";
  return <MobileSlideRemote serviceId={serviceId} />;
}
