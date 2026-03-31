"use client";

import Badge from "./ui/Badge";

export default function IsRealBadge({ isReal }: { isReal: boolean }) {
  if (isReal) return <Badge tone="success">is_real: true</Badge>;
  return <Badge tone="warning">is_real: false</Badge>;
}

