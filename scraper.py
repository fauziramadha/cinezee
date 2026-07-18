import os
import json
import requests
from playwright.sync_api import sync_playwright

ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY")
WORKER_URL = os.environ.get("WORKER_URL")
DLE_USER_ID = "134087"
DLE_PASSWORD = "c822631d9c6c68fa90f0f60724516519"

def run_scraper():
    print("🚀 Launching Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        # Inject cookies
        context.add_cookies([
            {"name": "dle_user_id", "value": DLE_USER_ID, "domain": ".cinemacity.cc", "path": "/", "secure": True, "httpOnly": True},
            {"name": "dle_password", "value": DLE_PASSWORD, "domain": ".cinemacity.cc", "path": "/", "secure": True, "httpOnly": True}
        ])
        
        page = context.new_page()
        
        print("🌐 Fetching cinemacity.cc homepage...")
        try:
            # UBAH KE domcontentloaded + timeout 90 detik
            page.goto("https://cinemacity.cc/", wait_until="domcontentloaded", timeout=90000)
        except Exception as e:
            print(f"⚠️ Goto timeout/intercepted (normal for CF), continuing... {e}")
        
        # Tunggu Cloudflare challenge selesai
        print("⏳ Waiting for Cloudflare challenge...")
        for i in range(30):
            try:
                title = page.title()
                if "Just a moment" not in title and "CinemaCity" in title:
                    print(f"✅ Page loaded: {title}")
                    break
            except:
                pass
            page.wait_for_timeout(2000)
        else:
            print("⚠️ Cloudflare challenge might not be passed, attempting to extract anyway...")

        # Tunggu 3 detik biar DOM ke-render beneran
        page.wait_for_timeout(3000)
        
        # Extract movies using JavaScript evaluation
        print("🎬 Extracting movies from HTML...")
        movies = page.evaluate('''() => {
            const results = [];
            const links = document.querySelectorAll('a[href*="/movies/"], a[href*="/tv-series/"]');
            
            links.forEach(link => {
                const href = link.href;
                const match = href.match(/\/(movies|tv-series)\/(\d+)-([^\/]+)\.html/);
                if (match) {
                    const type = match[1] === 'movies' ? 'movie' : 'tv';
                    const id = match[2];
                    const slug = `${match[2]}-${match[3]}`;
                    
                    // Cari title dan poster
                    let title = link.textContent.trim();
                    const img = link.querySelector('img');
                    let poster = img ? img.src : null;
                    
                    // Bersihkan title
                    title = title.replace(/\(\d{4}\)/, '').trim();
                    
                    if (title && title.length > 1 && !results.find(m => m.slug === slug)) {
                        results.push({ id, slug, title, type, poster, year: null, stream_url: null });
                    }
                }
            });
            
            return results.slice(0, 30);
        }''')
        
        print(f"🎬 Found {len(movies)} movies.")
        
        # Fetch stream URL untuk 10 film pertama
        print("🔗 Fetching stream URLs for top 10 movies...")
        for i, movie in enumerate(movies[:10]):
            try:
                print(f"  [{i+1}/10] {movie['title']}")
                page.goto(f"https://cinemacity.cc/{'movies' if movie['type'] == 'movie' else 'tv-series'}/{movie['slug']}.html", wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
                
                stream_url = page.evaluate('''() => {
                    const scripts = document.querySelectorAll('script');
                    for (let s of scripts) {
                        const match = s.textContent.match(/atob\("([^"]+)"\)/);
                        if (match) {
                            try {
                                const decoded = atob(match[1]);
                                const fileMatch = decoded.match(/file\\s*:\\s*'\\[{"title":"[^"]+","file":"([^"]+)"/);
                                if (fileMatch) return fileMatch[1];
                            } catch (e) {}
                        }
                    }
                    return null;
                }''')
                
                movie['stream_url'] = stream_url
                print(f"    ✅ Stream found" if stream_url else "    ❌ No stream")
            except Exception as e:
                print(f"    ❌ Error: {e}")
        
        browser.close()
        return movies

if __name__ == "__main__":
    movies = run_scraper()
    
    if movies:
        print(f"\n☁️ Uploading {len(movies)} movies to D1...")
        headers = {
            "X-Admin-API-Key": ADMIN_API_KEY,
            "Content-Type": "application/json"
        }
        
        try:
            r = requests.post(
                f"{WORKER_URL}/api/cinemacity/scrape",
                json=movies,
                headers=headers,
                timeout=30
            )
            print(f"Status: {r.status_code}")
            print(f"Response: {r.text}")
        except Exception as e:
            print(f"❌ Upload failed: {e}")
    else:
        print("❌ No movies found. Exiting.")
