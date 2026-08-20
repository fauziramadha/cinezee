import { NextRequest, NextResponse } from "next/server";
import { comic } from "@/lib/comic-api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const data = await comic.getHome();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API comic/home] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        statusCode: 500,
        message: error?.message || "Error fetching comic home",
        ok: false,
        data: null,
      },
      { status: 500 }
    );
  }
}
