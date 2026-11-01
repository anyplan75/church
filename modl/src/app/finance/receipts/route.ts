import { NextResponse } from "next/server";
import { buildReceiptZip, readableFinanceError } from "@/server/finance/service";
import { sameOriginPath } from "@/server/public-url";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  try {
    const result = await buildReceiptZip(start, end);
    if (!result.ok) {
      return NextResponse.redirect(sameOriginPath(request, `/finance?note=${result.note}`));
    }
    return new NextResponse(new Uint8Array(result.bytes), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": "attachment; filename=\"modl-receipts.zip\"",
      },
    });
  } catch (error) {
    return NextResponse.redirect(sameOriginPath(request, `/finance?error=${encodeURIComponent(readableFinanceError(error))}`));
  }
}
