import type { ReactNode } from "react";

export default function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["glass rounded-2xl border border-white/10", className].join(" ")}>
      {children}
    </div>
  );
}

