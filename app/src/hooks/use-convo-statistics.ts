import { useQuery } from "@tanstack/react-query";
import { getConvoStatistics, type ConvoStatistics } from "../api/convo-statistics";

export function useConvoStatistics(convoId: string | null | undefined) {
  return useQuery<ConvoStatistics>({
    queryKey: ["convo-statistics", convoId],
    queryFn: () => getConvoStatistics(convoId!),
    enabled: !!convoId,
  });
}
