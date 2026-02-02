import { api } from "@/trpc/server";
import { redirect } from "next/navigation";
import { OnboardingStepper } from "./components/OnboardingStepper";

export const dynamic = "force-dynamic";

export default async () => {
  const leagues = await api.league.getAll();
  if (leagues.length > 0) {
    redirect("/leagues");
  }
  return (
    <main className="flex min-h-screen flex-col items-center py-24 px-5 gap-8 max-w-3xl mx-auto">
      <div className="flex w-full flex-col gap-4">
        <OnboardingStepper />
      </div>
    </main>
  );
};
