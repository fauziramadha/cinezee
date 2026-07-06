import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const targetImageUrl = req.nextUrl.searchParams.get('url');

    if (!targetImageUrl) {
        return new NextResponse('Parameter "url" gambar wajib diisi', { status: 400 });
    }

    try {
        // 1. Pecah URL gambar aslinya
        const parsedUrl = new URL(targetImageUrl);

        // 2. Setup Header untuk bypass hotlink protection
        const customHeaders: Record<string, string> = {
            "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": "https://komiku.org/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        };

        // 3. Fetch langsung dari URL asli
        const response = await fetch(targetImageUrl, {
            headers: customHeaders
        });

        if (!response.ok) {
            console.error(`[Proxy] Fetch failed: ${response.status} for ${targetImageUrl}`);
            return new NextResponse(`Gagal mengambil gambar: ${response.statusText}`, { status: response.status });
        }

        // 4. Ambil data gambar
        const buffer = await response.arrayBuffer();
        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new NextResponse(buffer, {
            status: 200,
            headers: headers
        });
    } catch (error) {
        console.error("[Proxy] Error:", error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
