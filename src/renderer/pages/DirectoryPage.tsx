import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { DirectoryNode } from "@/lib/types";

function TreeLine({
  node,
  prefix,
  isLast,
}: {
  node: DirectoryNode;
  prefix: string;
  isLast: boolean;
}) {
  const connector = isLast ? "└── " : "├── ";
  const childPrefix = prefix + (isLast ? "    " : "│   ");

  return (
    <>
      <div className="flex items-center text-sm font-mono leading-6">
        <span className="text-muted-foreground whitespace-pre">{prefix + connector}</span>
        <Link
          to={`/directory/${node.id}`}
          className="flex items-center gap-1.5 hover:text-foreground text-[#cccccc] transition-colors"
        >
          <span>{node.icon ?? "📁"}</span>
          <span>{node.body}</span>
          {node.noteCount > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              ({node.noteCount})
            </span>
          )}
        </Link>
      </div>
      {node.children.map((child, i) => (
        <TreeLine
          key={child.id}
          node={child}
          prefix={childPrefix}
          isLast={i === node.children.length - 1}
        />
      ))}
    </>
  );
}

export default function DirectoryPage() {
  const [tree, setTree] = useState<DirectoryNode[]>([]);

  useEffect(() => {
    api.getDirectoryTree().then(setTree);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">🧠 脳の地図</h2>
        <p className="text-sm text-muted-foreground mt-1">
          自分の思考・感情・記憶の構造
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="font-mono text-sm">
          <div className="text-muted-foreground mb-2">🧠 脳</div>
          {tree.map((node, i) => (
            <TreeLine
              key={node.id}
              node={node}
              prefix=""
              isLast={i === tree.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
