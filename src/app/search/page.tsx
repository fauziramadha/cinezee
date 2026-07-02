import { Suspense } from "react";
import { Header } from "@/components/cinepro/header";
import { Loader2 } from "lucide-react";
import { SearchContent } from "./search-content";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background">
          <Header />
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
