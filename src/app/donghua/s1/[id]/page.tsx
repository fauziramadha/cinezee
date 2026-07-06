import { DonghuaDetailContent } from "@/components/donghua/donghua-detail-content";
export default async function S1DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DonghuaDetailContent slug={id} source="s1" />;
}
