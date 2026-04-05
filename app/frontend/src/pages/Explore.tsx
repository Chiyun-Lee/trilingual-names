import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { EXPLORE_COLUMNS, type ExploreColumn } from "../api/types";
import ParallelCategories from "../components/ParallelCategories";

const COLUMN_LABELS: Record<ExploreColumn, string> = {
  pinyin: "Pinyin",
  toneless_pinyin: "Toneless Pinyin",
  hangul: "Hangul",
  anglo_hangul: "Anglo-Hangul",
  katakana: "Katakana",
  anglo_katakana: "Anglo-Katakana",
};

export default function Explore() {
  const [source, setSource] = useState<ExploreColumn>("toneless_pinyin");
  const [target, setTarget] = useState<ExploreColumn>("anglo_hangul");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["explore", source, target],
    queryFn: () => api.getExplore(source, target),
    enabled: source !== target,
  });

  // Measure container for responsive SVG sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 900, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width: Math.max(400, width), height: Math.max(300, height) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", p: 2, gap: 2 }}>
      {/* Controls */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Source column</InputLabel>
          <Select
            value={source}
            label="Source column"
            onChange={(e) => setSource(e.target.value as ExploreColumn)}
          >
            {EXPLORE_COLUMNS.filter((c) => c !== target).map((c) => (
              <MenuItem key={c} value={c}>
                {COLUMN_LABELS[c]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography color="text.secondary">→</Typography>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Target column</InputLabel>
          <Select
            value={target}
            label="Target column"
            onChange={(e) => setTarget(e.target.value as ExploreColumn)}
          >
            {EXPLORE_COLUMNS.filter((c) => c !== source).map((c) => (
              <MenuItem key={c} value={c}>
                {COLUMN_LABELS[c]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {data && (
          <Typography variant="body2" color="text.secondary">
            {data.links.length} unique connections · {data.source_nodes.length} source values ·{" "}
            {data.target_nodes.length} target values
          </Typography>
        )}
      </Box>

      {/* Plot area */}
      <Box ref={containerRef} sx={{ flex: 1, overflow: "auto", position: "relative" }}>
        {isLoading && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <CircularProgress />
          </Box>
        )}
        {isError && (
          <Typography color="error">Failed to load explore data.</Typography>
        )}
        {data && (
          // The SVG is taller than the viewport for large datasets — scroll vertically
          <Box sx={{ minHeight: Math.max(dims.height, data.source_nodes.length * 22 + 80) }}>
            <ParallelCategories
              data={data}
              width={dims.width}
              height={Math.max(dims.height, data.source_nodes.length * 22 + 80)}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
