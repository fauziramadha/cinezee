import { AnimeGenreContent } from "./anime-genre-content";

export default async function AnimeGenrePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <AnimeGenreContent slug={slug} />;
}
