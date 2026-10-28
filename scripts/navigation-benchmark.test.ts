import { describe, expect, it } from "vitest";

import {
  evaluateNavigationBudget,
  parseNavigationBenchmarkConfig,
  summarizeDurations
} from "./navigation-benchmark";

describe("summarizeDurations", () => {
  it("reports stable p50 and p95 values from warm navigation samples", () => {
    expect(summarizeDurations([420, 180, 240, 900, 300])).toEqual({
      count: 5,
      minMs: 180,
      p50Ms: 300,
      p95Ms: 900,
      maxMs: 900
    });
  });
});

describe("parseNavigationBenchmarkConfig", () => {
  it("builds a benchmark matrix without exposing the authentication cookie", () => {
    expect(
      parseNavigationBenchmarkConfig({
        PERF_BASE_URL: "http://127.0.0.1:3100/",
        PERF_ROUTES: "/institutions/new,/,/accounts/account-1",
        PERF_ITERATIONS: "6",
        PERF_COOKIE: "session=secret",
        PERF_MAX_WARM_P95_MS: "800"
      })
    ).toEqual({
      baseUrl: "http://127.0.0.1:3100",
      routes: ["/institutions/new", "/", "/accounts/account-1"],
      iterations: 6,
      cookie: "session=secret",
      maxWarmP95Ms: 800
    });
  });

  it("requires one cold request and at least one warm request", () => {
    expect(() =>
      parseNavigationBenchmarkConfig({ PERF_ITERATIONS: "1" })
    ).toThrow("PERF_ITERATIONS must be an integer of at least 2.");
  });
});

describe("evaluateNavigationBudget", () => {
  it("fails when any route exceeds the warm p95 budget", () => {
    expect(
      evaluateNavigationBudget(
        [
          { route: "/", warm: { count: 5, minMs: 350, p50Ms: 500, p95Ms: 1_200, maxMs: 1_200 } },
          {
            route: "/institutions/new",
            warm: { count: 5, minMs: 80, p50Ms: 100, p95Ms: 130, maxMs: 130 }
          }
        ],
        800
      )
    ).toEqual({ passed: false, failingRoutes: ["/"] });
  });
});
