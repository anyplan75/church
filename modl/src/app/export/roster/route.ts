import { NextResponse } from "next/server";
import { readableExportError, rosterWorkbook } from "@/server/export/service";
import { sameOriginPath } from "@/server/public-url";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const bytes = await rosterWorkbook();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": "attachment; filename=\"modl-roster.xlsx\"",
      },
    });
  } catch (error) {
    return NextResponse.redirect(sameOriginPath(request, `/finance?error=${encodeURIComponent(readableExportError(error))}`));
  }
}
