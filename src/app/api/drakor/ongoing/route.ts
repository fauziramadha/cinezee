import { NextRequest, NextResponse } from "next/server";
import { drakor } from "@/lib/drakor-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") || "1";
    const data = await drakor.getOngoing(parseInt(page, 10));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API drakor/ongoing] Error:", error);
    return NextResponse.json(
      { status: "error", statusCode: 500, message: error?.message || "Error", ok: false, data: null },
      { status: 500 }
    );
  }
}
