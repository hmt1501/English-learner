import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  backHref,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  return (
    <header className="mb-4">
      {backHref && (
        <Link href={backHref} className="mb-1 inline-block text-sm font-medium text-primary">
          ← Quay lại
        </Link>
      )}
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}
