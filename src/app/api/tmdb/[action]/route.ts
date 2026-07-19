import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY  = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  const action = params.action;
  const { searchParams } = new URL(request.url);

  if (!TMDB_KEY) {
    return NextResponse.json(
      { error: "TMDB_API_KEY environment variable belum diset" },
      { status: 500 }
    );
  }

  let tmdbUrl = "";
  const appendResponse = "append_to_response=external_ids,credits,videos,images,similar,recommendations";

  switch (action) {
    case "trending": {
      const window = searchParams.get("window") || "week";
      const type   = searchParams.get("type")   || "all";
      const page   = searchParams.get("page")   || "1";
      tmdbUrl = `${TMDB_BASE}/trending/${type}/${window}?api_key=${TMDB_KEY}&page=${page}`;
      break;
    }
    case "popular": {
      const type = searchParams.get("type") || "movie";
      const page = searchParams.get("page") || "1";
      tmdbUrl = `${TMDB_BASE}/${type}/popular?api_key=${TMDB_KEY}&page=${page}`;
      break;
    }
    case "top_rated": {
      const type = searchParams.get("type") || "movie";
      const page = searchParams.get("page") || "1";
      tmdbUrl = `${TMDB_BASE}/${type}/top_rated?api_key=${TMDB_KEY}&page=${page}`;
      break;
    }
    case "search": {
      const q    = searchParams.get("q")    || "";
      const type = searchParams.get("type") || "movie";
      const page = searchParams.get("page") || "1";
      if (!q) return NextResponse.json({ results: [] });
      tmdbUrl = `${TMDB_BASE}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=${page}&include_adult=false`;
      break;
    }
    case "detail": {
      const id   = searchParams.get("id");
      const type = searchParams.get("type") || "movie";
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      tmdbUrl = `${TMDB_BASE}/${type}/${id}?api_key=${TMDB_KEY}&${appendResponse}`;
      break;
    }
    case "genres": {
      const type = searchParams.get("type") || "movie";
      tmdbUrl = `${TMDB_BASE}/genre/${type}/list?api_key=${TMDB_KEY}`;
      break;
    }
    case "discover": {
      const type        = searchParams.get("type")        || "movie";
      const genre       = searchParams.get("genre");
      const year        = searchParams.get("year");
      const sortBy      = searchParams.get("sort_by")     || "popularity.desc";
      const page        = searchParams.get("page")        || "1";
      const params = new URLSearchParams({
        api_key: TMDB_KEY,
        sort_by: sortBy,
        page,
        include_adult: "false",
      });
      if (genre) params.set("with_genres", genre);
      if (year) {
        if (type === "movie") params.set("primary_release_year", year);
        else params.set("first_air_date_year", year);
      }
      tmdbUrl = `${TMDB_BASE}/discover/${type}?${params.toString()}`;
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 404 });
  }

  try {
    const r = await fetch(tmdbUrl, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json",
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: `TMDB error ${r.status}`, body: text.slice(0, 300) },
        { status: 502 }
      );
    }

    const data = await r.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "TMDB fetch failed", message: err?.message },
      { status: 500 }
    );
  }
}
