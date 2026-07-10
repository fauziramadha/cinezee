import { NextRequest, NextResponse } from "next/server";
import { drakor } from "@/lib/drakor-api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, episode, quality } = body;
    if (!id || !episode) {
      return NextResponse.json(
        { status: "error", message: "Missing id or episode" },
        { status: 400 }
      );
    }
    const data = await drakor.getPlay(id, episode, quality);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API drakor/play] Error:", error);
    return NextResponse.json(
      { status: "error", statusCode: 500, message: error?.message || "Error", ok: false, data: null },
      { status: 500 }
    );
  }
}
