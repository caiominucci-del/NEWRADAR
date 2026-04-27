"use client";

import Badge from "./ui/Badge";

interface Props {
  isReal: boolean;
  pending?: boolean;
}

export default function IsRealBadge({ isReal, pending }: Props) {
  if (isReal) return <Badge tone="success">Dados reais</Badge>;
  if (pending) return <Badge tone="warning">Aguardando atualização</Badge>;
  return <Badge tone="warning">Sem dados</Badge>;
}
