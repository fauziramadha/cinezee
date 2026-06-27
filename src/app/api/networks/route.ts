import { NextResponse } from "next/server";
import { TMDB_BASE } from "@/lib/tmdb";

/**
 * GET /api/networks - Get TV network logos from TMDB
 * Returns: [{ id, name, logo_path }]
 */

const API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;

const NETWORK_IDS = [213, 1024, 2739, 2552, 49, 283, 3353, 4330];

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ networks: [] });
  }

  try {
    const networks = await Promise.all(
      NETWORK_IDS.map(async (id) => {
        try {
          const res = await fetch(`${TMDB_BASE}/network/${id}?api_key=${API_KEY}`, {
            next: { revalidate: 86400 },
          });
          if (!res.ok) return null;
          const data = await res.json();
          return {
            id: data.id,
            name: data.name,
            logo_path: data.logo_path,
          };
        } catch {
          return null;
        }
      })
    );

    const valid = networks.filter(Boolean);
    return NextResponse.json(
      { networks: valid },
      { headers: { "Cache-Control": "public, s-maxage=86400" } }
    );
  } catch {
    return NextResponse.json({ networks: [] });
  }
}
