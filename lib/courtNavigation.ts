/** One tab order for the court page and every drawer shortcut. */
export const COURT_TABS = [
  { value: "feed", label: "Feed" },
  { value: "schedule", label: "Schedule" },
  { value: "players", label: "Players" },
  { value: "info", label: "Info" },
] as const;

export type CourtTab = (typeof COURT_TABS)[number]["value"];

/** Previously shared links still open their content after the tab regrouping. */
export function courtTabFromParam(tab: string | undefined): CourtTab {
  if (tab === "games" || tab === "week") return "schedule";
  return COURT_TABS.find((item) => item.value === tab)?.value ?? "feed";
}
