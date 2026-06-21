#!/usr/bin/env bash
# Deploy CineStream to Cloudflare Workers
# Usage: ./scripts/deploy-cloudflare.sh

set -e

echo "🎬 CineStream — Cloudflare Workers Deployment"
echo "=============================================="
echo ""

# 1. Check wrangler is installed
if ! command -v npx wrangler &> /dev/null; then
  echo "❌ wrangler not found. Installing..."
  npm install -g wrangler
fi

# 2. Login check
echo "📋 Step 1: Checking Cloudflare authentication..."
if ! npx wrangler whoami &> /dev/null; then
  echo "⚠️  Not logged in. Opening browser..."
  npx wrangler login
fi
echo "✅ Authenticated"
echo ""

# 3. Optional: Set TMDB API key
echo "📋 Step 2: TMDB API key check..."
echo "If you have a TMDB API key, set it now with:"
echo "  npx wrangler secret put TMDB_API_KEY"
echo ""
echo "Without a TMDB key, the app will use mock data (still functional)."
echo ""

read -p "Set TMDB API key now? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  npx wrangler secret put TMDB_API_KEY
fi
echo ""

# 4. Build
echo "📋 Step 3: Building for Cloudflare Workers..."
npx @opennextjs/cloudflare build
echo "✅ Build complete"
echo ""

# 5. Deploy
echo "📋 Step 4: Deploying to Cloudflare Workers..."
npx wrangler deploy
echo ""

echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Visit your deployed URL (shown above)"
echo "  2. Optional: Add a custom domain in Cloudflare Dashboard"
echo "  3. Optional: Set up KV namespace for advanced caching"
echo ""
echo "📖 Documentation: https://developers.cloudflare.com/workers/"
