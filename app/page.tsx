"use client";

import { useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { HomePage } from "@/components/home-page";
import { ModulesPage } from "@/components/modules-page";
import { SettingsPage } from "@/components/settings-page";

type Tab = "home" | "modules" | "settings";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");

  return (
    <main className="min-h-screen bg-background">
      {/* Content */}
      <div className="mx-auto max-w-lg">
        {activeTab === "home" && <HomePage />}
        {activeTab === "modules" && <ModulesPage />}
        {activeTab === "settings" && <SettingsPage />}
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}
