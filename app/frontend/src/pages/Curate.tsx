import FilterListIcon from "@mui/icons-material/FilterList";
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import type { Row, Vote, VoteValue } from "../api/types";
import VoteChip from "../components/VoteChip";

type VoteFilter = "all" | "upvoted" | "non-downvoted";

const PAGE_SIZE = 100;

// Build a lookup: "col::value::subIndex" → vote value
function buildVoteMap(votes: Vote[]): Map<string, VoteValue> {
  const map = new Map<string, VoteValue>();
  for (const v of votes) {
    map.set(`${v.column_name}::${v.value}::${v.sub_index ?? "null"}`, v.vote);
  }
  return map;
}

function getVote(
  map: Map<string, VoteValue>,
  col: string,
  value: string | null,
  subIndex: number | null = null
): VoteValue | null {
  if (!value) return null;
  return map.get(`${col}::${value}::${subIndex ?? "null"}`) ?? null;
}

// A row is "downvoted" if any of its cells has an active downvote
function rowIsDownvoted(row: Row, map: Map<string, VoteValue>): boolean {
  const checks: [string, string | null, number | null][] = [
    ["definition", row.definition, null],
    ["pinyin", row.pinyin, null],
    ["toneless_pinyin", row.toneless_pinyin, null],
    ["hangul", row.hangul, null],
    ["anglo_hangul", row.anglo_hangul, null],
    ["katakana", row.katakana, null],
    ["anglo_katakana", row.anglo_katakana, null],
    ["decomposed_pinyin", row.decomposed_pinyin.initial, 0],
    ["decomposed_pinyin", row.decomposed_pinyin.final, 1],
    row.decomposed_pinyin.tone !== null
      ? ["decomposed_pinyin", String(row.decomposed_pinyin.tone), 2]
      : ["decomposed_pinyin", null, 2],
  ];
  return checks.some(([col, val, idx]) => getVote(map, col, val, idx) === -1);
}

function rowIsUpvoted(row: Row, map: Map<string, VoteValue>): boolean {
  const checks: [string, string | null, number | null][] = [
    ["definition", row.definition, null],
    ["pinyin", row.pinyin, null],
    ["toneless_pinyin", row.toneless_pinyin, null],
    ["hangul", row.hangul, null],
    ["anglo_hangul", row.anglo_hangul, null],
    ["katakana", row.katakana, null],
    ["anglo_katakana", row.anglo_katakana, null],
  ];
  return checks.some(([col, val, idx]) => getVote(map, col, val, idx) === 1);
}

interface CellProps {
  col: string;
  value: string | null;
  vote: VoteValue | null;
}

function VotableCell({ col, value, vote }: CellProps) {
  if (!value) return <TableCell sx={{ color: "text.disabled" }}>—</TableCell>;
  return (
    <TableCell>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Typography variant="body2" component="span">
          {value}
        </Typography>
        <VoteChip columnName={col} value={value} currentVote={vote} />
      </Box>
    </TableCell>
  );
}

function DecomposedCell({ row, voteMap }: { row: Row; voteMap: Map<string, VoteValue> }) {
  const dp = row.decomposed_pinyin;
  if (!dp.raw) return <TableCell sx={{ color: "text.disabled" }}>—</TableCell>;

  const parts: [string | null, number, string][] = [
    [dp.initial, 0, "initial"],
    [dp.final, 1, "final"],
    [dp.tone !== null ? String(dp.tone) : null, 2, "tone"],
  ];

  return (
    <TableCell>
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
        {parts.map(([val, idx, label]) =>
          val ? (
            <Tooltip key={idx} title={label}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Chip
                  label={val}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: 11 }}
                />
                <VoteChip
                  columnName="decomposed_pinyin"
                  value={val}
                  subIndex={idx}
                  currentVote={getVote(voteMap, "decomposed_pinyin", val, idx)}
                />
              </Box>
            </Tooltip>
          ) : null
        )}
      </Box>
    </TableCell>
  );
}

export default function Curate() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<VoteFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["data", page],
    queryFn: () => api.getData(page, PAGE_SIZE),
  });

  const { data: votes = [] } = useQuery({
    queryKey: ["votes"],
    queryFn: api.getVotes,
  });

  const voteMap = useMemo(() => buildVoteMap(votes), [votes]);

  const rows = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.rows;
    if (filter === "upvoted") return data.rows.filter((r) => rowIsUpvoted(r, voteMap));
    return data.rows.filter((r) => !rowIsDownvoted(r, voteMap));
  }, [data, filter, voteMap]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const COLS = [
    "definition",
    "pinyin",
    "decomposed_pinyin",
    "toneless_pinyin",
    "hangul",
    "anglo_hangul",
    "katakana",
    "anglo_katakana",
  ] as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", p: 2, gap: 1.5 }}>
      {/* Toolbar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <FilterListIcon color="action" />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Show</InputLabel>
          <Select
            value={filter}
            label="Show"
            onChange={(e) => setFilter(e.target.value as VoteFilter)}
          >
            <MenuItem value="all">All rows</MenuItem>
            <MenuItem value="non-downvoted">Non-downvoted</MenuItem>
            <MenuItem value="upvoted">Upvoted only</MenuItem>
          </Select>
        </FormControl>
        {data && (
          <Typography variant="body2" color="text.secondary">
            {rows.length} / {data.total} rows
          </Typography>
        )}
      </Box>

      {/* Table */}
      {isLoading ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer sx={{ flex: 1, overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>漢</TableCell>
                {COLS.map((c) => (
                  <TableCell key={c} sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {c.replace(/_/g, " ")}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  sx={
                    rowIsDownvoted(row, voteMap)
                      ? { opacity: 0.4 }
                      : rowIsUpvoted(row, voteMap)
                        ? { bgcolor: "success.50" }
                        : {}
                  }
                >
                  <TableCell sx={{ fontSize: 20 }}>{row.hanzi}</TableCell>
                  <VotableCell
                    col="definition"
                    value={row.definition}
                    vote={getVote(voteMap, "definition", row.definition)}
                  />
                  <VotableCell
                    col="pinyin"
                    value={row.pinyin}
                    vote={getVote(voteMap, "pinyin", row.pinyin)}
                  />
                  <DecomposedCell row={row} voteMap={voteMap} />
                  <VotableCell
                    col="toneless_pinyin"
                    value={row.toneless_pinyin}
                    vote={getVote(voteMap, "toneless_pinyin", row.toneless_pinyin)}
                  />
                  <VotableCell
                    col="hangul"
                    value={row.hangul}
                    vote={getVote(voteMap, "hangul", row.hangul)}
                  />
                  <VotableCell
                    col="anglo_hangul"
                    value={row.anglo_hangul}
                    vote={getVote(voteMap, "anglo_hangul", row.anglo_hangul)}
                  />
                  <VotableCell
                    col="katakana"
                    value={row.katakana}
                    vote={getVote(voteMap, "katakana", row.katakana)}
                  />
                  <VotableCell
                    col="anglo_katakana"
                    value={row.anglo_katakana}
                    vote={getVote(voteMap, "anglo_katakana", row.anglo_katakana)}
                  />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Pagination
            count={totalPages}
            page={page + 1}
            onChange={(_, p) => setPage(p - 1)}
            size="small"
          />
        </Box>
      )}
    </Box>
  );
}
