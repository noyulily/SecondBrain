import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { GraphNode, GraphEdge } from "@/lib/types";

type PositionedNode = GraphNode & { x: number; y: number; width: number; height: number };

const DIR_W = 140; const DIR_H = 36;
const NOTE_W = 120; const NOTE_H = 28;
const LEVEL_GAP = 200; const NODE_GAP = 14;

function buildPositions(nodes: GraphNode[]): PositionedNode[] {
  const childrenOf = new Map<string | null, GraphNode[]>();
  for (const n of nodes) {
    const arr = childrenOf.get(n.parentId) ?? [];
    arr.push(n);
    childrenOf.set(n.parentId, arr);
  }
  const positioned: PositionedNode[] = [];
  function subtreeHeight(n: GraphNode): number {
    const children = childrenOf.get(n.id) ?? [];
    if (children.length === 0) return (n.isDirectory ? DIR_H : NOTE_H) + NODE_GAP;
    return children.reduce((s, c) => s + subtreeHeight(c), 0);
  }
  function place(n: GraphNode, x: number, yCenter: number) {
    const children = childrenOf.get(n.id) ?? [];
    const w = n.isDirectory ? DIR_W : NOTE_W;
    const h = n.isDirectory ? DIR_H : NOTE_H;
    positioned.push({ ...n, x, y: yCenter - h / 2, width: w, height: h });
    if (children.length === 0) return;
    const totalH = children.reduce((s, c) => s + subtreeHeight(c), 0);
    let cursor = yCenter - totalH / 2;
    for (const child of children) {
      const ch = subtreeHeight(child);
      place(child, x + LEVEL_GAP, cursor + ch / 2);
      cursor += ch;
    }
  }
  const roots = childrenOf.get(null) ?? [];
  const totalH = roots.reduce((s, r) => s + subtreeHeight(r), 0);
  let y = -totalH / 2;
  for (const root of roots) {
    const h = subtreeHeight(root);
    place(root, 0, y + h / 2);
    y += h;
  }
  return positioned;
}

function MindMap({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [hoveredEdge, setHoveredEdge] = useState<{ fromId: string; toId: string } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const getCssVar = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const bg        = getCssVar("--background") || "#08090a";
  const cardColor = getCssVar("--card")       || "#141518";
  const border    = getCssVar("--border")     || "#1f2023";
  const fg        = getCssVar("--foreground") || "#e6e6e6";
  const muted     = getCssVar("--muted-foreground") || "#9ca3af";
  const primary   = getCssVar("--primary")    || "#5e6ad2";

  const positioned = buildPositions(nodes);
  const posMap = new Map(positioned.map((n) => [n.id, n]));

  // ノードホバー時：そのノードに繋がるリンクの相手ノードもハイライト
  const linkEdgesDedup = (() => {
    const seen = new Set<string>();
    return edges.filter((e) => {
      if (e.type !== "link") return false;
      const key = [e.fromId, e.toId].sort().join("|");
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  })();

  const hoveredNodeIds: Set<string> = (() => {
    if (hoveredEdge) return new Set([hoveredEdge.fromId, hoveredEdge.toId]);
    if (hoveredNodeId) {
      const connected = new Set<string>([hoveredNodeId]);
      for (const e of linkEdgesDedup) {
        if (e.fromId === hoveredNodeId) connected.add(e.toId);
        if (e.toId   === hoveredNodeId) connected.add(e.fromId);
      }
      return connected;
    }
    return new Set();
  })();

  // ノードホバー時にハイライトすべきエッジかどうか
  function isEdgeHighlighted(fromId: string, toId: string): boolean {
    if (hoveredEdge) {
      return (hoveredEdge.fromId === fromId && hoveredEdge.toId === toId) ||
             (hoveredEdge.fromId === toId   && hoveredEdge.toId === fromId);
    }
    if (hoveredNodeId) {
      return fromId === hoveredNodeId || toId === hoveredNodeId;
    }
    return false;
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || positioned.length === 0) return;
    const { width, height } = svg.getBoundingClientRect();

    // ノード全体のバウンディングボックスを計算
    const minX = Math.min(...positioned.map((n) => n.x));
    const maxX = Math.max(...positioned.map((n) => n.x + n.width));
    const minY = Math.min(...positioned.map((n) => n.y));
    const maxY = Math.max(...positioned.map((n) => n.y + n.height));
    const contentW = maxX - minX;
    const contentH = maxY - minY;

    // 余白を考慮してスケールを決定（最大1倍）
    const padding = 60;
    const scaleX = (width  - padding * 2) / contentW;
    const scaleY = (height - padding * 2) / contentH;
    const fitScale = Math.min(scaleX, scaleY, 1);

    // コンテンツ中心が画面中心に来るよう translate を計算
    const contentCx = (minX + maxX) / 2;
    const contentCy = (minY + maxY) / 2;
    setScale(fitScale);
    setTx(width  / 2 - contentCx * fitScale);
    setTy(height / 2 - contentCy * fitScale);
  }, [nodes]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.2, Math.min(3, s * (e.deltaY < 0 ? 1.1 : 0.91))));
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setTx((t) => t + e.clientX - lastPos.current.x);
    setTy((t) => t + e.clientY - lastPos.current.y);
    lastPos.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp() { dragging.current = false; }

  // Deduplicate link edges
  const seenLinks = new Set<string>();
  const deduplicatedEdges = edges.filter((edge) => {
    if (edge.type !== "link") return true;
    const key = [edge.fromId, edge.toId].sort().join("|");
    if (seenLinks.has(key)) return false;
    seenLinks.add(key);
    return true;
  });

  function renderParentEdges() {
    return deduplicatedEdges
      .filter((e) => e.type === "parent")
      .map((edge, i) => {
        const from = posMap.get(edge.fromId);
        const to   = posMap.get(edge.toId);
        if (!from || !to) return null;
        const x1 = from.x + from.width; const y1 = from.y + from.height / 2;
        const x2 = to.x;                const y2 = to.y + to.height / 2;
        const mx = (x1 + x2) / 2;
        return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
          fill="none" stroke={border} strokeWidth={1.5} />;
      });
  }

  function renderLinkEdges() {
    const linkEdges = deduplicatedEdges.filter((e) => e.type === "link");
    return linkEdges.map((edge, i) => {
      const from = posMap.get(edge.fromId);
      const to   = posMap.get(edge.toId);
      if (!from || !to) return null;

      const isHovered = isEdgeHighlighted(edge.fromId, edge.toId);

      const fromCx = from.x + from.width  / 2;
      const fromCy = from.y + from.height / 2;
      const toCx   = to.x   + to.width    / 2;
      const toCy   = to.y   + to.height   / 2;
      const dx = toCx - fromCx;
      const dy = toCy - fromCy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const angle = Math.atan2(dy, dx);

      // Exit/entry points on node borders
      const x1 = fromCx + Math.cos(angle) * (from.width  / 2 + 3);
      const y1 = fromCy + Math.sin(angle) * (from.height / 2 + 3);
      const x2 = toCx   - Math.cos(angle) * (to.width    / 2 + 3);
      const y2 = toCy   - Math.sin(angle) * (to.height   / 2 + 3);

      // Perpendicular arc — alternates side per edge index, scales with distance
      const nx = -dy / len;
      const ny =  dx / len;
      const arcAmount = Math.min(130, len * 0.45) * (i % 2 === 0 ? 1 : -1);
      const cpx = (x1 + x2) / 2 + nx * arcAmount;
      const cpy = (y1 + y2) / 2 + ny * arcAmount;
      const pathD = `M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`;

      return (
        <g
          key={`link-${edge.fromId}-${edge.toId}`}
          onPointerEnter={() => setHoveredEdge({ fromId: edge.fromId, toId: edge.toId })}
          onPointerLeave={() => setHoveredEdge(null)}
          style={{ cursor: "default" }}
        >
          {/* Wide invisible hit area */}
          <path d={pathD} fill="none" stroke="transparent" strokeWidth={20} />
          {/* Glow layer when hovered */}
          {isHovered && (
            <path d={pathD} fill="none" stroke="#f59e0b"
              strokeWidth={8} opacity={0.15} strokeLinecap="round" />
          )}
          {/* Visible line */}
          <path d={pathD} fill="none"
            stroke={isHovered ? "#f59e0b" : muted}
            strokeWidth={isHovered ? 1.8 : 1}
            opacity={isHovered ? 0.85 : 0.3}
            strokeLinecap="round"
            strokeDasharray={isHovered ? undefined : "4 4"}
          />
        </g>
      );
    });
  }

  function renderNodes() {
    return positioned.map((n) => {
      const isDir = n.isDirectory;
      const isHighlighted = hoveredNodeIds.has(n.id);
      const fill      = isDir ? (n.color ? `${n.color}22` : cardColor) : cardColor;
      const stroke    = isHighlighted ? primary : (isDir ? (n.color ?? primary) : border);
      const strokeW   = isHighlighted ? 2.5 : (isDir ? 1.5 : 1);
      const textFill  = isHighlighted ? fg : (isDir ? fg : muted);
      const clipId    = `clip-${n.id}`;
      const textX     = n.x + (n.icon ? 22 : 8);
      const textMaxW  = n.width - (n.icon ? 28 : 16);

      return (
        <g key={n.id} style={{ cursor: "pointer" }}
          onClick={(e) => { e.stopPropagation(); navigate(isDir ? `/directory/${n.id}` : `/note/${n.id}`); }}
          onPointerEnter={() => setHoveredNodeId(n.id)}
          onPointerLeave={() => setHoveredNodeId(null)}>
          <defs>
            <clipPath id={clipId}>
              <rect x={textX} y={n.y} width={textMaxW} height={n.height} />
            </clipPath>
          </defs>
          {/* Highlight halo */}
          {isHighlighted && (
            <rect
              x={n.x - 4} y={n.y - 4}
              width={n.width + 8} height={n.height + 8}
              rx={isDir ? 11 : 9}
              fill="none" stroke={primary} strokeWidth={1.5} opacity={0.35}
            />
          )}
          <rect x={n.x} y={n.y} width={n.width} height={n.height}
            rx={isDir ? 8 : 6} fill={fill} stroke={stroke} strokeWidth={strokeW} />
          {n.icon && (
            <text x={n.x + 6} y={n.y + n.height / 2 + 1} dominantBaseline="middle" fontSize={13}>
              {n.icon}
            </text>
          )}
          <text
            x={textX} y={n.y + n.height / 2 + 1}
            dominantBaseline="middle" fontSize={isDir ? 12 : 11}
            fill={textFill} fontWeight={isDir ? 600 : 400}
            clipPath={`url(#${clipId})`}>
            {n.body}
          </text>
        </g>
      );
    });
  }

  return (
    <svg ref={svgRef} className="w-full h-full select-none" style={{ background: bg }}
      onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
      <g transform={`translate(${tx},${ty}) scale(${scale})`}>
        {renderParentEdges()}
        {renderNodes()}
        {renderLinkEdges()}
      </g>
      {/* Legend */}
      <g transform="translate(16,16)">
        <rect width={164} height={62} rx={8} fill={cardColor} stroke={border} />
        <line x1={12} y1={22} x2={32} y2={22} stroke={border} strokeWidth={1.5} />
        <text x={38} y={26} fontSize={11} fill={muted}>階層 (親→子)</text>
        <line x1={12} y1={42} x2={32} y2={42} stroke={muted} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
        <text x={38} y={46} fontSize={11} fill={muted}>リンク (関連付け)</text>
      </g>
    </svg>
  );
}

export default function BrainPage() {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);

  useEffect(() => { api.getGraphData().then(setGraphData); }, []);

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h2 className="text-xl font-bold">MindMap</h2>
        <p className="text-xs text-muted-foreground mt-0.5">スクロールでズーム、ドラッグでパン</p>
      </div>
      <div className="flex-1 overflow-hidden">
        {graphData
          ? <MindMap nodes={graphData.nodes} edges={graphData.edges} />
          : <div className="flex items-center justify-center h-full text-muted-foreground">読み込み中…</div>
        }
      </div>
    </div>
  );
}
