import dynamic from "next/dynamic";

// ssr: false akan memaksa Next.js SKIP halaman ini saat build/prerender
const HistoryContent = dynamic(() => import("./history-content"), { ssr: false });

export default function HistoryPage() {
  return <HistoryContent />;
}
