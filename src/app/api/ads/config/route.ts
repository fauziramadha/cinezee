import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

async function getAdsConfigFromDB(): Promise<any> {
  // Pakai D1 binding langsung (bypass Prisma untuk edge runtime)
  const { D1 } = process as any;
  if (!D1) return null;

  try {
    const result = await D1.prepare(
      "SELECT * FROM ads_config WHERE id = 1"
    ).first();
    return result;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // Cek session user (untuk premium check)
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    let isPremium = false;
    if (userId) {
      const { D1 } = process as any;
      if (D1) {
        try {
          const user = await D1.prepare(
            "SELECT is_premium FROM User WHERE id = ?"
          )
            .bind(userId)
            .first();
          isPremium = !!user?.is_premium;
        } catch {
          // Kolom is_premium belum ada → assume not premium
        }
      }
    }

    const config = await getAdsConfigFromDB();

    // Kalau premium atau config belum diset → return kosong (tidak ada iklan)
    if (isPremium || !config) {
      return NextResponse.json({
        hilltopads: null,
        monetag: { popunder_url: null },
        adsterra: { direct_link: null },
        isPremium,
      } satisfies AdsConfig);
    }

    // Build config berdasarkan toggle di CMS
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
