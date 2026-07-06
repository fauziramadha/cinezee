import { ComicGenreContent } from "./comic-genre-content";

export default async function ComicGenrePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ComicGenreContent slug={slug} />;
}
