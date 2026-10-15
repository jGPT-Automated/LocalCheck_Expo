import assert from "node:assert/strict";
import test from "node:test";

import {
  buttonLabel,
  introLine,
  monthlyEquivalent,
  periodLabel,
  renewalDisclosure,
  yearlySavingsPercent,
} from "./planModel.ts";

const yearly = { price: 49.99, priceString: "$49.99" };
const monthly = { price: 4.99, priceString: "$4.99" };

test("yearly per month and savings", () => {
  assert.equal(monthlyEquivalent(yearly), "$4.16");
  assert.equal(yearlySavingsPercent(yearly, monthly), 17);
  assert.equal(yearlySavingsPercent({ ...yearly, price: 70 }, monthly), null);
});

test("buttons", () => {
  assert.equal(buttonLabel(yearly, "yearly"), "GET YEARLY · $49.99/YR");
  assert.equal(buttonLabel(monthly, "monthly"), "GET MONTHLY · $4.99/MO");
  assert.equal(buttonLabel(null, "yearly"), "NOT AVAILABLE YET");
});

test("free trials say when they end and that cancelling costs nothing", () => {
  const trial = { ...yearly, intro: { price: 0, priceString: "$0.00", periodUnit: "WEEK", periodNumberOfUnits: 1 } };
  assert.equal(introLine(trial, "yearly"), "Free for 1 week, then $49.99/year.");
  assert.equal(buttonLabel(trial, "yearly"), "START FREE TRIAL");
  assert.match(renewalDisclosure(trial, "yearly"), /Cancel before the free 1 week ends and you won't be charged\./);
  assert.equal(introLine(yearly, "yearly"), null);
});

test("disclosure covers price, renewal and where to cancel", () => {
  const text = renewalDisclosure(monthly, "monthly");
  assert.match(text, /\$4\.99 per month/);
  assert.match(text, /Renews automatically until you cancel/);
  assert.match(text, /App Store account settings/);
  assert.equal(periodLabel("DAY", 3), "3 days");
});
