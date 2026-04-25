import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import DirectoryPage from "./pages/DirectoryPage";
import DirectoryDetailPage from "./pages/DirectoryDetailPage";
import NoteDetailPage from "./pages/NoteDetailPage";
import TasksPage from "./pages/TasksPage";
import SearchPage from "./pages/SearchPage";
import BrainPage from "./pages/BrainPage";
import SettingsPage from "./pages/SettingsPage";
import { applyTheme, applyBackground, loadTheme, loadColorMode, loadBackground } from "./lib/themes";

export default function App() {
  useEffect(() => {
    applyTheme(loadTheme(), loadColorMode());
    applyBackground(loadBackground());
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="directory" element={<DirectoryPage />} />
          <Route path="directory/:id" element={<DirectoryDetailPage />} />
          <Route path="note/:id" element={<NoteDetailPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="brain" element={<BrainPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
