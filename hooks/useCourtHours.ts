import { useQuery } from "@tanstack/react-query";

import { courtHours, formatCourtHours } from "@/lib/courtHours";
import { fetchCourtsWeekSpans } from "@/services/courtService";

/**
 * Court hours · wk for every court in a list ("70h"), from one batched read.
 * Missing courts (still loading, or a failed read) read as a dash, never a
 * made-up number.
 */
export function useCourtHours(courtIds: string[]): (courtId: string) => string {
  const ids = [...new Set(courtIds)].sort();
  const { data } = useQuery({
    queryKey: ["court-week-hours", ids],
    queryFn: () => fetchCourtsWeekSpans(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });
  return (courtId) => {
    const spans = data?.[courtId];
    return spans ? formatCourtHours(courtHours(spans).hours) : "—";
  };
}
