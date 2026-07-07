import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/cinepro/header";
import { UniversalSearchContent } from "./search-content";

export default function UniversalSearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background">
          <Header />
          <div className="flex h-[60vh] items-center justify-center pt-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      }
    >
      <UniversalSearchContent />
    </Suspense>
  );
}
