/**
 * CINESTREAM - Vaplayer Stream API Proxy
 * -------------------------------------------------------
 * Reverse-engineered endpoint untuk streamdata.vaplayer.ru/api.php
 *
 * Format:
 *   Movie:  /api/vaplayer/stream?imdb=tt1375666&type=movie
 *   TV:     /api/vaplayer/stream?imdb=tt0903747&type=tv&season=1&episode=1
 *
 * Response (proxy langsung dari upstream):
 *   {
 *     "status_code": "200",
 *     "data": {
 *       "title": "Inception 2010",
 *       "imdb_id": "tt1375666",
 *       "file_name": "...",
 *       "backdrop": "https://image.tmdb.org/...",
 *       "stream_urls": ["https://onlinevisibilitysystem.site/.../master.m3u8", ...],
 *       "default_subs": [],
 *       "thumbnails_url": "https://vidapi.cloud/.../thumbnails.vtt"
 *     }
 *   }
 *
 * Cache: 1 jam (stream URL berubah setiap beberapa jam karena token rotation)
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const UPSTREAM = 'https://streamdata.vaplayer.ru/api.php';
const REFERER  = 'https://nextgencloudfabric.com/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const imdb   = searchParams.get('imdb');
  const type   = searchParams.get('type') || 'movie';  // 'movie' | 'tv'
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  // === Validate ===
  if (!imdb) {
    return NextResponse.json(
      { error: 'Parameter "imdb" wajib diisi. Contoh: ?imdb=tt1375666' },
      { status: 400 }
    );
  }

  if (!imdb.match(/^tt\d{6,}$/i)) {
    return NextResponse.json(
      { error: 'Format imdb tidak valid. Contoh valid: tt1375666' },
      { status: 400 }
    );
  }

  if (type !== 'movie' && type !== 'tv') {
    return NextResponse.json(
      { error: 'Parameter "type" harus "movie" atau "tv"' },
      { status: 400 }
    );
  }

  if (type === 'tv' && (!season || !episode)) {
    return NextResponse.json(
      { error: 'Untuk type=tv, parameter "season" dan "episode" wajib diisi' },
      { status: 400 }
    );
  }

  // === Build upstream URL ===
  const params = new URLSearchParams({
    imdb: imdb,
    type: type,
  });
  if (type === 'tv') {
    params.set('season',  String(season));
    params.set('episode', String(episode));
  }
  const upstreamUrl = `${UPSTREAM}?${params.toString()}`;

  try {
    const upstreamResp = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'User-Agent':      UA,
        'Referer':         REFERER,
        'Origin':          'https://nextgencloudfabric.com',
        'Accept':          'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Requested-With':'XMLHttpRequest',
      },
    });

    if (!upstreamResp.ok) {
      return NextResponse.json(
        {
          error: `Upstream error: ${upstreamResp.status}`,
          upstream_status: upstreamResp.status,
        },
        { status: 502 }
      );
    }

    const ct = upstreamResp.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      // Upstream return HTML (biasanya 404 atau block page)
      const text = await upstreamResp.text();
      return NextResponse.json(
        {
          error: 'Upstream tidak return JSON',
          content_type: ct,
          body_preview: text.slice(0, 200),
        },
        { status: 502 }
      );
    }

    const data = await upstreamResp.json();

    // Validate response shape
    if (data?.status_code !== '200' || !data?.data?.stream_urls?.length) {
      return NextResponse.json(
        {
          error: 'Film tidak ditemukan di vaplayer.ru',
          upstream_response: data,
        },
        { status: 404 }
      );
    }

    // === Return ke client (dengan cache 1 jam) ===
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err: any) {
    console.error('[vaplayer/stream] Error:', err);
    return NextResponse.json(
      {
        error: 'Internal error',
        message: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
