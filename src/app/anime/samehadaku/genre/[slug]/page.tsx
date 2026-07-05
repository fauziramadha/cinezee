import { AnimeGenreContent } from "@/app/anime/genre/[slug]/anime-genre-content";

export default async function SamehadakuGenrePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <AnimeGenreContent slug={slug} source="samehadaku" />;
}
