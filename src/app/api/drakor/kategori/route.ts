import { NextRequest, NextResponse } from "next/server";
import { drakor } from "@/lib/drakor-api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const data = await drakor.getKategori();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API drakor/kategori] Error:", error);
    return NextResponse.json(
      { status: "error", statusCode: 500, message: error?.message || "Error", ok: false, data: null },
      { status: 500 }
    );
  }
}
