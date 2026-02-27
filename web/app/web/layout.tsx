import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthGuard } from "./components/AuthGuard";
import { Sidebar } from "./components/Sidebar";
import { ShieldAiWidget } from "./components/ShieldAiWidget";
import { TopBar } from "./components/TopBar";
import "./styles/globals.css";

type WebLayoutProps = {
  children: ReactNode;
};

export default function WebLayout({ children }: WebLayoutProps) {
  return (
    <ThemeProvider>
      <AuthGuard>
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="flex-1 overflow-auto p-6">{children}</main>
            </div>
          </div>
          <ShieldAiWidget />
        </div>
      </AuthGuard>
    </ThemeProvider>
  );
}
