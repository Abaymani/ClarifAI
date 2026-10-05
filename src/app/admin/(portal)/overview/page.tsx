import { OverviewTable } from "@/app/admin/(portal)/overview/overview-table";
import { listAdminOverview } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const participants = await listAdminOverview();

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6 p-5 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Översikt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Se sessionsstatus eller forskarnas kodningsarbete per lektion.
        </p>
      </div>
      <OverviewTable participants={participants} />
    </main>
  );
}
