import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const UPSTREAM = 'https://streamdata.vaplayer.ru/api.php';
const REFERER  = 'https://nextgencloudfabric.com/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const imdb   = searchParams.get('imdb');
  const type   = searchParams.get('type') || 'movie';
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  if (!imdb) {
    return NextResponse.json({ error: 'Parameter "imdb" wajib diisi' }, { status: 400 });
  }

  if (!imdb.match(/^tt\d{6,}$/i)) {
    return NextResponse.json({ error: 'Format imdb tidak valid' }, { status: 400 });
  }

  if (type !== 'movie' && type !== 'tv') {
    return NextResponse.json({ error: 'type harus "movie" atau "tv"' }, { status: 400 });
  }

  if (type === 'tv' && (!season || !episode)) {
    return NextResponse.json({ error: 'tv wajib punya season dan episode' }, { status: 400 });
  }

  const params = new URLSearchParams({ imdb, type });
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
        { error: `Upstream error: ${upstreamResp.status}` },
        { status: 502 }
      );
    }

    const ct = upstreamResp.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      const text = await upstreamResp.text();
      return NextResponse.json(
        { error: 'Upstream tidak return JSON', body_preview: text.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = await upstreamResp.json();

    if (data?.status_code !== '200' || !data?.data?.stream_urls?.length) {
      return NextResponse.json(
        { error: 'Film tidak ditemukan di vaplayer.ru' },
        { status: 404 }
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal error', message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
