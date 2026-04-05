export interface DecomposedPinyin {
  raw: string;
  initial: string | null;
  final: string | null;
  tone: number | null;
}

export interface Row {
  id: number;
  hanzi: string | null;
  definition: string | null;
  pinyin: string | null;
  decomposed_pinyin: DecomposedPinyin;
  toneless_pinyin: string | null;
  hangul: string | null;
  anglo_hangul: string | null;
  katakana: string | null;
  anglo_katakana: string | null;
}

export interface DataResponse {
  total: number;
  page: number;
  page_size: number;
  rows: Row[];
}

export type VoteValue = 1 | -1;

export interface Vote {
  column_name: string;
  value: string;
  sub_index: number | null;
  vote: VoteValue;
}

export interface ExploreLink {
  source: string;
  target: string;
  count: number;
  samples: { hanzi: string | null; definition: string | null }[];
}

export interface ExploreResponse {
  source_column: string;
  target_column: string;
  source_nodes: string[];
  target_nodes: string[];
  links: ExploreLink[];
}

export type VoteableColumn =
  | "definition"
  | "pinyin"
  | "decomposed_pinyin"
  | "toneless_pinyin"
  | "hangul"
  | "anglo_hangul"
  | "katakana"
  | "anglo_katakana";

export type ExploreColumn =
  | "pinyin"
  | "toneless_pinyin"
  | "hangul"
  | "anglo_hangul"
  | "katakana"
  | "anglo_katakana";

export const EXPLORE_COLUMNS: ExploreColumn[] = [
  "pinyin",
  "toneless_pinyin",
  "hangul",
  "anglo_hangul",
  "katakana",
  "anglo_katakana",
];
