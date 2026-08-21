import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-start px-6 pt-8">
        <Link
          href="/"
          aria-label="Nomos"
          className="inline-flex items-center gap-2.5"
        >
          <Image
            src="/logo.svg"
            alt="Nomos"
            width={38}
            height={35}
            priority
            className="h-12 w-auto dark:invert"
          />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Nomos
            </span>
            <span className="text-sm text-muted-foreground">
              A society simulation you can run in the browser.
            </span>
          </span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="flex flex-col items-center gap-1 px-6 pb-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>© {year} Nomos</span>
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <span>All rights reserved</span>
        </div>
        <div className="text-sm text-muted-foreground/70">
          Open source.{" "}
          <a
            href="https://github.com/nenadmarinkovic/nomos"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            View on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
