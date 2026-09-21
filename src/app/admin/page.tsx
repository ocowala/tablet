import { redirect } from "next/navigation";

import { AdminForm } from "@/components/AdminForm";
import { currentUser } from "@/lib/server/auth";
import { isAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!isAdmin(user)) redirect("/");
  return <AdminForm />;
}
