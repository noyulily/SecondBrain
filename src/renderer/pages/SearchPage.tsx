import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import type { Note } from "@/lib/types";
import MasonryGrid from "@/components/MasonryGrid";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<Note[]>([]);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const res = await api.searchNotes(q);
    setResults(res);
    setSearched(true);
  }, []);

  useEffect(() => {
    if (q) {
      setQuery(q);
      doSearch(q);
    }
  }, [q, doSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchParams(query ? { q: query } : {});
    doSearch(query);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">🔍 検索</h2>
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="メモ・タグを検索…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="text-xs px-3 py-1 rounded-lg bg-foreground text-background hover:bg-foreground/80 transition-colors"
          >
            検索
          </button>
        </div>
      </form>

      {searched && (
        <p className="text-sm text-muted-foreground mb-4">
          {results.length > 0
            ? `${results.length} 件見つかりました`
            : `"${query}" に一致するメモはありませんでした`}
        </p>
      )}

      {results.length > 0 && (
        <MasonryGrid
          notes={results}
          onMutate={() => doSearch(query)}
        />
      )}

      {!searched && !q && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <span className="text-4xl mb-4">🔍</span>
          <p className="text-sm">検索ワードを入力してください</p>
          <p className="text-xs mt-1 text-muted-foreground/60">
            本文・タグで検索できます
          </p>
        </div>
      )}
    </div>
  );
}
