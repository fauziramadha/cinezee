import { AnimeGenreContent } from "@/components/anime/anime-genre-content";

export default async function Server2GenrePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <AnimeGenreContent slug={slug} source="animasu" />;
}
