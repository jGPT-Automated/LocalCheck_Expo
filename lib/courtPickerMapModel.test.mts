import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_VIEW, mapView, projectToView, SINGLE_POINT_ZOOM } from "./courtPickerMapModel.ts";

const W = 360;
const H = 300;

test("no points shows the default view", () => {
  assert.deepEqual(mapView([], W, H), DEFAULT_VIEW);
});

test("one point is centred at neighborhood zoom", () => {
  const view = mapView([{ lat: 30.31, lng: -95.46 }], W, H);
  assert.equal(view.zoom, SINGLE_POINT_ZOOM);
  const p = projectToView({ lat: 30.31, lng: -95.46 }, view, W, H);
  assert.ok(Math.abs(p.x - W / 2) < 0.5 && Math.abs(p.y - H / 2) < 0.5);
});

test("every point lands inside the view, away from the edges", () => {
  const points = [
    { lat: 30.31, lng: -95.46 },
    { lat: 30.35, lng: -95.41 },
    { lat: 30.27, lng: -95.5 },
  ];
  const view = mapView(points, W, H);
  for (const point of points) {
    const p = projectToView(point, view, W, H);
    assert.ok(p.x > W * 0.1 && p.x < W * 0.9, `x ${p.x}`);
    assert.ok(p.y > H * 0.15 && p.y < H * 0.85, `y ${p.y}`);
  }
});

test("north is up and east is right", () => {
  const view = mapView([{ lat: 30, lng: -95 }, { lat: 30.1, lng: -94.9 }], W, H);
  const sw = projectToView({ lat: 30, lng: -95 }, view, W, H);
  const ne = projectToView({ lat: 30.1, lng: -94.9 }, view, W, H);
  assert.ok(ne.x > sw.x);
  assert.ok(ne.y < sw.y);
});
