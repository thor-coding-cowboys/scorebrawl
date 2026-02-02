import { AuthView } from "@daveyplate/better-auth-ui";
import { authViewPaths } from "@daveyplate/better-auth-ui/server";

export function generateStaticParams() {
  return Object.values(authViewPaths).map((pathname) => ({ pathname }));
}

export default async function AuthPage({ params }: { params: Promise<{ pathname: string }> }) {
  const { pathname } = await params;

  return (
    <div className="flex flex-col grow size-full items-center justify-center gap-3">
      <AuthView pathname={pathname} />
    </div>
  );
}
