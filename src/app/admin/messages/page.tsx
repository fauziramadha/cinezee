/**
 * src/app/admin/messages/page.tsx
 *
 * Halaman admin untuk kirim & manage messages.
 * Hanya bisa diakses admin (auth check ada di layout.tsx).
 *
 * URL: /admin/messages
 */

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { MessageComposer } from "@/components/admin/message-composer";

export default async function AdminMessagesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/?callbackUrl=/admin/messages");
  }

  if ((session.user as any).role !== "admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <MessageComposer />
    </div>
  );
}
