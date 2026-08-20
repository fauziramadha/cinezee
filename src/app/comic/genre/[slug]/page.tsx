import { ComicGenreContent } from "./content";

export const dynamic = "force-dynamic";

export default async function ComicGenrePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/\/+$/, "").trim();
  return <ComicGenreContent slug={cleanSlug} />;
}
