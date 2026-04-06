import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import { Box, IconButton, Tooltip } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Vote, VoteValue } from "../api/types";

interface Props {
  columnName: string;
  value: string;
  subIndex?: number | null;
  currentVote: VoteValue | null;
}

export default function VoteChip({
  columnName,
  value,
  subIndex = null,
  currentVote,
}: Props) {
  const qc = useQueryClient();

  const mutate = useMutation({
    mutationFn: async (incoming: VoteValue | null) => {
      if (incoming === null) {
        await api.deleteVote({ column_name: columnName, value, sub_index: subIndex });
      } else {
        await api.putVote({ column_name: columnName, value, sub_index: subIndex, vote: incoming });
      }
    },
    onMutate: async (incoming) => {
      await qc.cancelQueries({ queryKey: ["votes"] });
      const prev = qc.getQueryData<Vote[]>(["votes"]);
      qc.setQueryData<Vote[]>(["votes"], (old = []) => {
        const thisKey = `${columnName}::${value}::${subIndex}`;
        const rest = old.filter(
          (v) => `${v.column_name}::${v.value}::${v.sub_index}` !== thisKey
        );
        if (incoming !== null) {
          rest.push({ column_name: columnName, value, sub_index: subIndex, vote: incoming });
        }
        return rest;
      });
      return { prev };
    },
    onError: (_err, _incoming, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["votes"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["votes"] });
      qc.invalidateQueries({ queryKey: ["data"] });
    },
  });

  const handle = (v: VoteValue) => {
    // Clicking the active vote revokes it
    mutate.mutate(currentVote === v ? null : v);
  };

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
      <Tooltip title="Upvote">
        <IconButton
          size="small"
          onClick={() => handle(1)}
          color={currentVote === 1 ? "success" : "default"}
          sx={{ p: 0.25 }}
        >
          <ThumbUpIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Downvote">
        <IconButton
          size="small"
          onClick={() => handle(-1)}
          color={currentVote === -1 ? "error" : "default"}
          sx={{ p: 0.25 }}
        >
          <ThumbDownIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
