"use client";

import { Sidebar } from "./sidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto overscroll-contain">{children}</main>
    </div>
  );
}
