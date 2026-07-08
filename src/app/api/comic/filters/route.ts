import { NextRequest, NextResponse } from "next/server";
import { comic } from "@/lib/comic-api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const data = await comic.getFilters();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API comic/filters] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        statusCode: 500,
        message: error?.message || "Error fetching comic filters",
        ok: false,
        data: null,
      },
      { status: 500 }
    );
  }
}
