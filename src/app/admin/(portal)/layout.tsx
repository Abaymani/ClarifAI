import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAdminAction } from "@/app/admin/actions";
import { PortalNav } from "@/app/admin/(portal)/portal-nav";
import { Button } from "@/components/ui/button";
import { getCurrentResearcher } from "@/lib/admin/auth";
import { researcherName } from "@/lib/admin/researchers";

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
        <div className="mx-auto flex min-h-16 w-full max-w-[96rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/admin/overview" className="text-xl font-semibold">
              ClarifAI
            </Link>
            <span className="border-l pl-4 text-sm text-muted-foreground">
              Forskarportal
            </span>
            <PortalNav />
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
              {researcherName(researcher.id)}
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
