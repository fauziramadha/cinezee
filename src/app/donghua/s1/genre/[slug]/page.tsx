import { DonghuaGenreContent } from "@/components/donghua/donghua-genre-content";
export default async function S1GenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DonghuaGenreContent slug={slug} source="s1" />;
}
