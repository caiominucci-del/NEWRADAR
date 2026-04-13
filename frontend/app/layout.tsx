"use client";

import "./globals.css";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import { getAuthToken } from "../lib/auth";
import Skeleton from "../components/ui/Skeleton";

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    const authenticated = !!token;
    setIsAuth(authenticated);
    if (!authenticated && pathname !== "/login") {
      router.replace("/login");
    }
  }, [pathname, router]);

  if (isAuth === null) {
    // Loading state, avoid flicker
    return (
      <html lang="pt-BR">
        <body>
          <div className="min-h-screen flex bg-transparent">
            <main className="flex-1 px-5 py-6">
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-11/12" />
                <Skeleton className="h-10 w-10/12" />
              </div>
            </main>
          </div>
        </body>
      </html>
    );
  }

  const showSidebar = isAuth && pathname !== "/login";

  return (
    <html lang="pt-BR">
      <head>
        <title>Radar BP — Equipe</title>
        <meta
          name="description"
          content="Central de produção editorial e análise de tendências"
        />
      </head>
      <body>
        <div className="min-h-screen flex bg-transparent">
          {showSidebar && <Sidebar />}
          <main className="flex-1 px-5 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
