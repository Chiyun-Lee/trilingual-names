import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
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
  TableSortLabel,
  TextField,
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

function rowVoteCells(row: Row): [string, string | null, number | null][] {
  return [
    ["radical", row.radical, null],
    ["definition", row.definition, null],
    ["pinyin", row.pinyin, null],
    ["toneless_pinyin", row.toneless_pinyin, null],
    ["hangul", row.hangul, null],
    ["anglo_hangul", row.anglo_hangul, null],
    ["katakana", row.katakana, null],
    ["anglo_katakana", row.anglo_katakana, null],
    ["name_use", row.name_use, null],
    ["note", row.note, null],
    ["decomposed_pinyin", row.decomposed_pinyin.initial, 0],
    ["decomposed_pinyin", row.decomposed_pinyin.final, 1],
    row.decomposed_pinyin.tone !== null
      ? ["decomposed_pinyin", String(row.decomposed_pinyin.tone), 2]
      : ["decomposed_pinyin", null, 2],
  ];
}

// A row is "downvoted" if any of its cells has an active downvote
function rowIsDownvoted(row: Row, map: Map<string, VoteValue>): boolean {
  return rowVoteCells(row).some(([col, val, idx]) => getVote(map, col, val, idx) === -1);
}

function rowIsUpvoted(row: Row, map: Map<string, VoteValue>): boolean {
  return rowVoteCells(row).some(([col, val, idx]) => getVote(map, col, val, idx) === 1);
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

type SortCol = "hanzi" | "simplified" | "radical" | "definition" | "meaning" | "name_use" | "note"
  | "pinyin" | "toneless_pinyin" | "hangul" | "anglo_hangul" | "katakana" | "anglo_katakana";

function rowSortKey(row: Row, col: SortCol): string {
  if (col === "decomposed_pinyin" as string) return row.decomposed_pinyin.raw ?? "";
  const val = row[col as keyof Row];
  if (val === null || val === undefined) return "";
  return String(val);
}

export default function Curate() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<VoteFilter>("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data, isLoading } = useQuery({
    queryKey: ["data", page, filter, search],
    queryFn: () => api.getData(page, PAGE_SIZE, filter, search),
  });

  const { data: votes = [] } = useQuery({
    queryKey: ["votes"],
    queryFn: api.getVotes,
  });

  const voteMap = useMemo(() => buildVoteMap(votes), [votes]);

  const rawRows = data?.rows ?? [];
  const rows = useMemo(() => {
    // In non-downvoted mode, re-apply the filter client-side so newly downvoted
    // rows disappear instantly from the optimistic vote cache update.
    const base = filter === "non-downvoted"
      ? rawRows.filter((row) => !rowIsDownvoted(row, voteMap))
      : rawRows;
    if (!sortCol) return base;
    return [...base].sort((a, b) => {
      const ka = rowSortKey(a, sortCol);
      const kb = rowSortKey(b, sortCol);
      // Empty values always sink to bottom
      if (!ka && kb) return 1;
      if (ka && !kb) return -1;
      const cmp = ka.localeCompare(kb, undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rawRows, sortCol, sortDir, filter, voteMap]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const COLS: { key: string; sortable: boolean }[] = [
    { key: "simplified",       sortable: true  },
    { key: "radical",          sortable: true  },
    { key: "definition",       sortable: true  },
    { key: "meaning",          sortable: true  },
    { key: "name_use",         sortable: true  },
    { key: "note",             sortable: true  },
    { key: "pinyin",           sortable: true  },
    { key: "decomposed_pinyin", sortable: false },
    { key: "toneless_pinyin",  sortable: true  },
    { key: "hangul",           sortable: true  },
    { key: "anglo_hangul",     sortable: true  },
    { key: "katakana",         sortable: true  },
    { key: "anglo_katakana",   sortable: true  },
  ];

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
            onChange={(e) => {
              setFilter(e.target.value as VoteFilter);
              setPage(0);
            }}
          >
            <MenuItem value="all">All rows</MenuItem>
            <MenuItem value="non-downvoted">Non-downvoted</MenuItem>
            <MenuItem value="upvoted">Upvoted only</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          placeholder="Search…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 220 }}
        />
        {data && (
          <Typography variant="body2" color="text.secondary">
            {filter === "non-downvoted" ? rows.length : data.total} row{data.total !== 1 ? "s" : ""}
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
                <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>
                  <TableSortLabel
                    active={sortCol === "hanzi"}
                    direction={sortCol === "hanzi" ? sortDir : "asc"}
                    onClick={() => handleSort("hanzi")}
                  >
                    漢
                  </TableSortLabel>
                </TableCell>
                {COLS.map(({ key, sortable }) => (
                  <TableCell key={key} sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {sortable ? (
                      <TableSortLabel
                        active={sortCol === key}
                        direction={sortCol === key ? sortDir : "asc"}
                        onClick={() => handleSort(key as SortCol)}
                      >
                        {key.replace(/_/g, " ")}
                      </TableSortLabel>
                    ) : (
                      key.replace(/_/g, " ")
                    )}
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
                  <TableCell sx={{ color: "text.secondary" }}>{row.simplified}</TableCell>
                  <VotableCell
                    col="radical"
                    value={row.radical}
                    vote={getVote(voteMap, "radical", row.radical)}
                  />
                  <VotableCell
                    col="definition"
                    value={row.definition}
                    vote={getVote(voteMap, "definition", row.definition)}
                  />
                  <TableCell>{row.meaning}</TableCell>
                  <VotableCell
                    col="name_use"
                    value={row.name_use}
                    vote={getVote(voteMap, "name_use", row.name_use)}
                  />
                  <VotableCell
                    col="note"
                    value={row.note}
                    vote={getVote(voteMap, "note", row.note)}
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
