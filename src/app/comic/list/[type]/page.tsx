import { ComicListContent } from "./comic-list-content";

export default async function ComicListPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  return <ComicListContent type={type} />;
}
