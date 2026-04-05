import { Group } from "@visx/group";
import { useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { scaleLinear } from "d3-scale";
import { linkHorizontal } from "d3-shape";
import { useCallback, useMemo } from "react";
import type { ExploreLink, ExploreResponse } from "../api/types";

const MARGIN = { top: 20, bottom: 20, left: 140, right: 140 };
const NODE_HEIGHT = 18;
const NODE_GAP = 4;
const MIN_LINK_OPACITY = 0.15;
const MAX_LINK_OPACITY = 0.7;

interface TooltipData {
  link: ExploreLink;
}

interface NodeRect {
  label: string;
  y: number;
  height: number;
  total: number;
}

function buildNodes(
  labels: string[],
  totals: Map<string, number>,
  innerHeight: number
): NodeRect[] {
  const n = labels.length;
  const totalGap = NODE_GAP * (n - 1);
  const totalNodeHeight = innerHeight - totalGap;
  const maxTotal = Math.max(...labels.map((l) => totals.get(l) ?? 0));
  const scale = totalNodeHeight / Math.max(1, labels.reduce((s, l) => s + (totals.get(l) ?? 0), 0));

  let y = 0;
  return labels.map((label) => {
    const total = totals.get(label) ?? 0;
    const height = Math.max(NODE_HEIGHT, total * scale);
    const rect = { label, y, height, total };
    y += height + NODE_GAP;
    return rect;
  });
}

export default function ParallelCategories({
  data,
  width,
  height,
}: {
  data: ExploreResponse;
  width: number;
  height: number;
}) {
  const { tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } =
    useTooltip<TooltipData>();
  const { containerRef, TooltipInPortal } = useTooltipInPortal({ detectBounds: true });

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Precompute per-node totals
  const srcTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of data.links) map.set(l.source, (map.get(l.source) ?? 0) + l.count);
    return map;
  }, [data]);

  const tgtTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of data.links) map.set(l.target, (map.get(l.target) ?? 0) + l.count);
    return map;
  }, [data]);

  const srcNodes = useMemo(
    () => buildNodes(data.source_nodes, srcTotals, innerHeight),
    [data.source_nodes, srcTotals, innerHeight]
  );
  const tgtNodes = useMemo(
    () => buildNodes(data.target_nodes, tgtTotals, innerHeight),
    [data.target_nodes, tgtTotals, innerHeight]
  );

  const srcNodeMap = useMemo(
    () => new Map(srcNodes.map((n) => [n.label, n])),
    [srcNodes]
  );
  const tgtNodeMap = useMemo(
    () => new Map(tgtNodes.map((n) => [n.label, n])),
    [tgtNodes]
  );

  // Track how much of each node's height we've consumed when placing link bands
  const srcOffset = useMemo(() => new Map<string, number>(), [data]);
  const tgtOffset = useMemo(() => new Map<string, number>(), [data]);

  const maxCount = useMemo(() => Math.max(...data.links.map((l) => l.count), 1), [data]);
  const opacityScale = useMemo(
    () => scaleLinear<number>().domain([0, maxCount]).range([MIN_LINK_OPACITY, MAX_LINK_OPACITY]),
    [maxCount]
  );

  const linkPath = linkHorizontal<{ x: number; y: number }, { x: number; y: number }>()
    .x((d) => d.x)
    .y((d) => d.y);

  const handleHover = useCallback(
    (event: React.MouseEvent, link: ExploreLink) => {
      showTooltip({
        tooltipData: { link },
        tooltipLeft: event.clientX,
        tooltipTop: event.clientY,
      });
    },
    [showTooltip]
  );

  // Render links — we iterate in order and track fill offsets per node
  const srcOffsets = new Map<string, number>();
  const tgtOffsets = new Map<string, number>();

  const renderedLinks = data.links.map((link) => {
    const sNode = srcNodeMap.get(link.source);
    const tNode = tgtNodeMap.get(link.target);
    if (!sNode || !tNode) return null;

    const sTotal = srcTotals.get(link.source) ?? 1;
    const tTotal = tgtTotals.get(link.target) ?? 1;

    const sBand = (link.count / sTotal) * sNode.height;
    const tBand = (link.count / tTotal) * tNode.height;
    const sOff = srcOffsets.get(link.source) ?? 0;
    const tOff = tgtOffsets.get(link.target) ?? 0;

    srcOffsets.set(link.source, sOff + sBand);
    tgtOffsets.set(link.target, tOff + tBand);

    const sy0 = sNode.y + sOff;
    const sy1 = sy0 + sBand;
    const ty0 = tNode.y + tOff;
    const ty1 = ty0 + tBand;

    const topPath = linkPath({ source: { x: 0, y: sy0 }, target: { x: innerWidth, y: ty0 } })!;
    // Strip the leading "M x,y " so the bottom curve continues from the current point
    // rather than starting a new subpath (which would break the Z close-path target).
    const botRaw = linkPath({ source: { x: innerWidth, y: ty1 }, target: { x: 0, y: sy1 } })!;
    const botCurve = botRaw.replace(/^M[^C]*/, "");
    const d = `${topPath} L${innerWidth},${ty1} ${botCurve} Z`;

    return (
      <path
        key={`${link.source}-${link.target}`}
        d={d}
        fill="steelblue"
        opacity={opacityScale(link.count)}
        onMouseMove={(e) => handleHover(e, link)}
        onMouseLeave={hideTooltip}
        style={{ cursor: "pointer", transition: "opacity 0.15s" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.opacity = String(Math.min(1, opacityScale(link.count) + 0.3)))
        }
        onMouseOut={(e) =>
          (e.currentTarget.style.opacity = String(opacityScale(link.count)))
        }
      />
    );
  });

  return (
    <>
      <svg ref={containerRef} width={width} height={height} style={{ overflow: "visible" }}>
        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* Links */}
          {renderedLinks}

          {/* Source nodes (left) */}
          {srcNodes.map((node) => (
            <Group key={node.label}>
              <rect x={-8} y={node.y} width={8} height={node.height} fill="steelblue" rx={2} />
              <text
                x={-14}
                y={node.y + node.height / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={12}
                fill="currentColor"
              >
                {node.label}
              </text>
            </Group>
          ))}

          {/* Target nodes (right) */}
          {tgtNodes.map((node) => (
            <Group key={node.label}>
              <rect x={innerWidth} y={node.y} width={8} height={node.height} fill="coral" rx={2} />
              <text
                x={innerWidth + 14}
                y={node.y + node.height / 2}
                dominantBaseline="middle"
                fontSize={12}
                fill="currentColor"
              >
                {node.label}
              </text>
            </Group>
          ))}

          {/* Column labels */}
          <text x={-8} y={-8} textAnchor="end" fontSize={13} fontWeight={600} fill="currentColor">
            {data.source_column.replace(/_/g, " ")}
          </text>
          <text x={innerWidth + 8} y={-8} fontSize={13} fontWeight={600} fill="currentColor">
            {data.target_column.replace(/_/g, " ")}
          </text>
        </Group>
      </svg>

      {tooltipData && (
        <TooltipInPortal left={tooltipLeft} top={tooltipTop}>
          <div style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.5 }}>
            <strong>
              {tooltipData.link.source} → {tooltipData.link.target}
            </strong>
            <div style={{ color: "#555" }}>{tooltipData.link.count} characters</div>
            <hr style={{ margin: "4px 0", borderColor: "#ddd" }} />
            {tooltipData.link.samples.map((s, i) => (
              <div key={i}>
                <span style={{ fontSize: 18 }}>{s.hanzi}</span>{" "}
                <span style={{ color: "#444" }}>{s.definition}</span>
              </div>
            ))}
            {tooltipData.link.count > 5 && (
              <div style={{ color: "#888", marginTop: 4 }}>
                +{tooltipData.link.count - 5} more…
              </div>
            )}
          </div>
        </TooltipInPortal>
      )}
    </>
  );
}
