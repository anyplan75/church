import { ServiceEditorScreen } from "@/components/service-screens";
import { STATIC_SERVICE_IDS } from "@/lib/static-services";

export function generateStaticParams() {
  return STATIC_SERVICE_IDS.map((id) => ({ id }));
}

export default function ServicePage() {
  return <ServiceEditorScreen />;
}
