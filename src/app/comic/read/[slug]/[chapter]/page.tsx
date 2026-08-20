import { ComicReader } from "@/components/comic/comic-reader";

export const dynamic = "force-dynamic";

export default async function ComicReadPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/\/+$/, "").trim();
  const cleanChapter = decodeURIComponent(chapter).replace(/\/+$/, "").trim();
  return <ComicReader comicSlug={cleanSlug} chapterNumber={cleanChapter} />;
}
