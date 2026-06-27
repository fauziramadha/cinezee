/**
 * src/app/not-found.tsx
 *
 * Custom 404 page — force dynamic to avoid SSG issues with client providers.
 */

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center text-white">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-3xl font-extrabold shadow-lg">
        CS
      </div>
      <h1 className="mb-2 text-6xl font-bold tracking-tight">404</h1>
      <p className="mb-6 text-lg text-muted-foreground">
        Page not found
      </p>
      <a
        href="/"
        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to Home
      </a>
    </div>
  );
}
