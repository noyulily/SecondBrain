import NoteCard from "./NoteCard";
import type { Note } from "@/lib/types";

export default function MasonryGrid({
  notes,
  onMutate,
}: {
  notes: Note[];
  onMutate?: () => void;
}) {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <span className="text-5xl mb-4">🧠</span>
        <p className="text-sm">
          まだメモがありません。上の入力欄からメモしてみよう！
        </p>
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onMutate={onMutate} />
      ))}
    </div>
  );
}
