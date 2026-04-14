"use client";

import Badge from "./ui/Badge";

export default function IsRealBadge({ isReal }: { isReal: boolean }) {
  if (isReal) return <Badge tone="success">Em tempo real</Badge>;
  return <Badge tone="warning">Dados armazenados</Badge>;
}

