import { ComicReader } from "@/components/comic/comic-reader";

export default async function ComicReaderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ComicReader chapterSlug={slug} />;
}
