import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface AdsConfig {
  hilltopads: {
    preroll_url: string;
    duration: number;
    skip_delay: number;
  } | null;
  monetag: {
    popunder_url: string | null;
  };
  adsterra: {
    direct_link: string | null;
  };
  isPremium: boolean;
}

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (ctx?.env?.DB) {
    return ctx.env.DB as D1Database;
  }
  throw new Error('D1 database binding "DB" not found.');
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    let isPremium = false;
    if (userId) {
      try {
        const d1 = await getD1();
        const user = await d1
          .prepare("SELECT is_premium FROM User WHERE id = ?")
          .bind(userId)
          .first();
        isPremium = !!user?.is_premium;
      } catch {
        // Kolom is_premium belum ada → assume not premium
      }
    }

    let config: any = null;
    try {
      const d1 = await getD1();
      config = await d1.prepare("SELECT * FROM ads_config WHERE id = 1").first();
    } catch {
      // Tabel belum ada → return kosong
    }

    if (isPremium || !config) {
      return NextResponse.json({
        hilltopads: null,
        monetag: { popunder_url: null },
        adsterra: { direct_link: null },
        isPremium,
      } satisfies AdsConfig);
    }

    const hilltopads =
      config.pre_roll_enabled && config.hilltopads_preroll_url
        ? {
            preroll_url: config.hilltopads_preroll_url,
            duration: config.hilltopads_preroll_duration || 15,
            skip_delay: config.hilltopads_preroll_skip_delay || 5,
          }
        : null;

    return NextResponse.json({
      hilltopads,
      monetag: {
        popunder_url:
          config.monetag_popunder_enabled && config.monetag_popunder_url
            ? config.monetag_popunder_url
            : null,
      },
      adsterra: {
        direct_link:
          config.adsterra_enabled && config.adsterra_direct_link
            ? config.adsterra_direct_link
            : null,
      },
      isPremium,
    } satisfies AdsConfig);
  } catch (error) {
    console.error("[ADS CONFIG GET]", error);
    return NextResponse.json(
      {
        hilltopads: null,
        monetag: { popunder_url: null },
        adsterra: { direct_link: null },
        isPremium: false,
      },
      { status: 200 }
    );
  }
}
