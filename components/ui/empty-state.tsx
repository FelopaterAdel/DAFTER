import type { ComponentType, ReactNode, SVGProps } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-muted text-muted">
        <Icon className="size-6" />
      </span>
      <h3 className="mt-4 text-sm font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-6 text-muted">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
