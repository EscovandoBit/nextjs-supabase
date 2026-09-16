import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { cn } from "@/components/ui/cn";

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const mode = single(params.mode) === "signup" ? "signup" : "signin";
  const next = single(params.next);

  const query = next ? `&next=${encodeURIComponent(next)}` : "";

  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold tracking-tight">Tarefas</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Entre para ver e gerenciar suas tarefas.
      </p>

      {/* Tabs as real links driven by a search param, so they work with
          JavaScript disabled and each mode is a shareable URL. */}
      <nav aria-label="Entrar ou criar conta" className="mt-6 flex gap-1 rounded-md border border-line p-1">
        <Tab href={`/login?mode=signin${query}`} active={mode === "signin"}>
          Entrar
        </Tab>
        <Tab href={`/login?mode=signup${query}`} active={mode === "signup"}>
          Criar conta
        </Tab>
      </nav>

      <div className="mt-6">
        {/* key remounts the form when switching modes, clearing stale state */}
        <AuthForm key={mode} mode={mode} next={next} />
      </div>
    </main>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex-1 rounded px-3 py-1.5 text-center text-sm transition-colors",
        active ? "bg-surface-raised font-medium" : "text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
