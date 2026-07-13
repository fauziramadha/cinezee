import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

async function getEnvVar(key: string): Promise<string> {
  try {
    const ctx = await getCloudflareContext();
    return ((ctx?.env?.[key] as string) || "").trim();
  } catch {
    return (process.env[key] || "").trim();
  }
}

// Convert SRT to VTT
function srtToVtt(srt: string): string {
  let vtt = "WEBVTT\n\n";
  vtt += srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return vtt;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source"); // "os" atau "ss"
    const id = searchParams.get("id");

    if (!source || !id) {
      return new NextResponse("Missing parameters", { status: 400 });
    }

    let srtText = "";

    // === OpenSubtitles ===
    if (source === "os") {
      const apiKey = await getEnvVar("OPENSUBTITLES_API_KEY");
      if (!apiKey) return new NextResponse("OS API Key missing", { status: 500 });

      // Request download link
      const dlRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
        method: "POST",
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
          "User-Agent": "CineStream v1.0",
        },
        body: JSON.stringify({ file_id: parseInt(id, 10) }),
      });

      if (!dlRes.ok) return new NextResponse("Failed to get OS link", { status: 500 });
      
      const dlData = await dlRes.json();
      const link = dlData?.link;
      if (!link) return new NextResponse("No OS link", { status: 500 });

      // Download SRT
      const srtRes = await fetch(link);
      if (!srtRes.ok) return new NextResponse("Failed to download OS subtitle", { status: 500 });
      
      srtText = await srtRes.text();
    }

    // === SubSource ===
    if (source === "ss") {
      const apiKey = await getEnvVar("SUBSOURCE_API_KEY");
      if (!apiKey) return new NextResponse("SS API Key missing", { status: 500 });

      // SubSource returns ZIP, kita fetch saja dan extract text
      // Karena di Workers sulit extract ZIP, kita ambil URL download langsung dari API
      // dan biarkan browser yang handle? 
      // Atau kita bisa pakai API download yang return file langsung.
      const dlUrl = `https://api.subsource.net/api/v1/subtitles/${id}/download`;
      
      const srtRes = await fetch(dlUrl, {
        headers: { "X-API-Key": apiKey },
      });

      if (!srtRes.ok) return new NextResponse("Failed to download SS subtitle", { status: 500 });
      
      // Asumsi ini text SRT (jika ZIP, butuh library unzip di worker)
      srtText = await srtRes.text();
    }

    if (!srtText) {
      return new NextResponse("Empty subtitle", { status: 500 });
    }

    // Convert to VTT
    const vttText = srtToVtt(srtText);

    return new NextResponse(vttText, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });

  } catch (error: any) {
    return new NextResponse("Error: " + error.message, { status: 500 });
  }
}
