import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAdminAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { getCurrentResearcher } from "@/lib/admin/auth";

export default async function AdminPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const researcher = await getCurrentResearcher();
  if (!researcher) redirect("/admin");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-[96rem] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/admin/overview" className="text-xl font-semibold">
              ClarifAI
            </Link>
            <span className="border-l pl-4 text-sm text-muted-foreground">
              Forskarportal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
              {researcher.id}
            </span>
            <form action={logoutAdminAction}>
              <Button type="submit" variant="outline" size="sm">
                Logga ut
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
