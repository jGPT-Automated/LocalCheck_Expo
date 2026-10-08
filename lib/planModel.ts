/**
 * LocalPlus plan picker (step 6): Yearly and Monthly, Yearly preselected.
 * Pure so prices, savings and the required subscription disclosure are
 * tested without the store.
 */

export type PlanId = "yearly" | "monthly";

export type IntroOffer = {
  /** 0 for a free trial. */
  price: number;
  priceString: string;
  periodUnit: "DAY" | "WEEK" | "MONTH" | "YEAR" | string;
  periodNumberOfUnits: number;
};

export type PlanPrice = {
  price: number;
  priceString: string;
  currencyCode?: string;
  intro?: IntroOffer | null;
};

export const TERMS_URL = "https://localchecksports.com/terms";
export const PRIVACY_URL = "https://localchecksports.com/privacy";

/** "1 week", "3 days", "1 month". */
export function periodLabel(unit: string, count: number): string {
  const word = { DAY: "day", WEEK: "week", MONTH: "month", YEAR: "year" }[unit] ?? unit.toLowerCase();
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Yearly price spread over 12 months, in the yearly price's currency format. */
export function monthlyEquivalent(yearly: PlanPrice): string {
  const perMonth = Math.floor((yearly.price / 12) * 100) / 100;
  const symbol = yearly.priceString.replace(/[\d.,\s]/g, "") || "$";
  return `${symbol}${perMonth.toFixed(2)}`;
}

/** Whole-percent saving of Yearly over 12 x Monthly; null when not a saving. */
export function yearlySavingsPercent(yearly: PlanPrice, monthly: PlanPrice): number | null {
  const full = monthly.price * 12;
  if (!(full > 0) || !(yearly.price > 0) || yearly.price >= full) return null;
  return Math.round((1 - yearly.price / full) * 100);
}

/** "Free for 1 week, then $49.99/year." when the plan has a free trial. */
export function introLine(plan: PlanPrice, id: PlanId): string | null {
  const intro = plan.intro;
  if (!intro) return null;
  const per = id === "yearly" ? "year" : "month";
  const length = periodLabel(intro.periodUnit, intro.periodNumberOfUnits);
  if (intro.price === 0) return `Free for ${length}, then ${plan.priceString}/${per}.`;
  return `${intro.priceString} for ${length}, then ${plan.priceString}/${per}.`;
}

export function buttonLabel(plan: PlanPrice | null, id: PlanId): string {
  if (!plan) return "NOT AVAILABLE YET";
  if (plan.intro && plan.intro.price === 0) return "START FREE TRIAL";
  return id === "yearly" ? `GET YEARLY · ${plan.priceString}/YR` : `GET MONTHLY · ${plan.priceString}/MO`;
}

/**
 * The auto-renew disclosure Apple expects next to the buy button: price and
 * period, that it renews until cancelled, where to cancel, and (for trials)
 * that cancelling before the trial ends means no charge.
 */
export function renewalDisclosure(plan: PlanPrice | null, id: PlanId): string {
  if (!plan) return "Subscriptions renew automatically until you cancel.";
  const per = id === "yearly" ? "year" : "month";
  const trial =
    plan.intro && plan.intro.price === 0
      ? ` Cancel before the free ${periodLabel(plan.intro.periodUnit, plan.intro.periodNumberOfUnits)} ends and you won't be charged.`
      : "";
  return `${plan.priceString} per ${per}, charged to your Apple ID. Renews automatically until you cancel, at least 24 hours before the period ends, in your App Store account settings.${trial}`;
}
