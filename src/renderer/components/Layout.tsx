import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useEffect, useState } from "react";
import type { DirectoryNode } from "@/lib/types";
import { api } from "@/lib/api";

export default function Layout() {
  const [tree, setTree] = useState<DirectoryNode[]>([]);

  useEffect(() => {
    api.getDirectoryTree().then(setTree);
  }, []);

  // サイドバー更新用イベント
  useEffect(() => {
    const handler = () => {
      api.getDirectoryTree().then(setTree);
    };
    window.addEventListener("sidebar:refresh", handler);
    return () => window.removeEventListener("sidebar:refresh", handler);
  }, []);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar tree={tree} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
