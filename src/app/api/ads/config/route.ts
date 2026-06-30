import { NextResponse } from "next/server";

/**
 * GET /api/ads/config
 * Returns ad network configuration (public)
 */
export async function GET() {
  return NextResponse.json({
    hilltopads: {
      preroll_url: process.env.AD_HILLTOPADS_PREROLL || "",
      duration: 10, // detik
      skip_delay: 5, // detik sebelum tombol skip muncul
    },
    monetag: {
      script_url: process.env.AD_MONETAG_POPUNDER || "",
    },
    adsterra: {
      direct_link: process.env.AD_ADSTERRA_DIRECT || "",
    },
  }, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
