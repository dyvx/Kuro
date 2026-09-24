import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SectionHeader({
  title,
  viewAllHref,
  subtitle,
}: {
  title: string;
  viewAllHref?: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-txt sm:text-2xl">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-txt-faint">{subtitle}</p>}
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="group flex shrink-0 items-center gap-1 text-sm font-semibold text-txt-muted transition-colors hover:text-primary-300"
        >
          View all
          <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
