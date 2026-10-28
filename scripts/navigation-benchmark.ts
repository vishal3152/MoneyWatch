import { pathToFileURL } from "node:url";

type BenchmarkEnvironment = Record<string, string | undefined>;

export type DurationSummary = {
  count: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

export type NavigationBenchmarkConfig = {
  baseUrl: string;
  routes: string[];
  iterations: number;
  cookie?: string;
  maxWarmP95Ms: number;
};

export type NavigationRouteResult = {
  route: string;
  cold: {
    status: number;
    ttfbMs: number;
    totalMs: number;
  };
  warm: DurationSummary;
};

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

function percentile(sortedValues: number[], fraction: number): number {
  const index = Math.max(0, Math.ceil(sortedValues.length * fraction) - 1);
  return sortedValues[index]!;
}

export function summarizeDurations(values: number[]): DurationSummary {
  if (values.length === 0) {
    throw new Error("At least one duration is required.");
  }

  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    minMs: roundMs(sorted[0]!),
    p50Ms: roundMs(percentile(sorted, 0.5)),
    p95Ms: roundMs(percentile(sorted, 0.95)),
    maxMs: roundMs(sorted.at(-1)!)
  };
}

function positiveNumber(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
}

function iterationCount(value: string | undefined): number {
  const parsed = positiveNumber(value, 6, "PERF_ITERATIONS");
  if (!Number.isInteger(parsed) || parsed < 2) {
    throw new Error("PERF_ITERATIONS must be an integer of at least 2.");
  }
  return parsed;
}

export function parseNavigationBenchmarkConfig(
  environment: BenchmarkEnvironment
): NavigationBenchmarkConfig {
  const baseUrl = (environment.PERF_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
  const routes = (environment.PERF_ROUTES ?? "/institutions/new,/,/settings")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean)
    .map((route) => (route.startsWith("/") ? route : `/${route}`));

  if (routes.length === 0) {
    throw new Error("PERF_ROUTES must contain at least one route.");
  }

  return {
    baseUrl,
    routes,
    iterations: iterationCount(environment.PERF_ITERATIONS),
    cookie: environment.PERF_COOKIE || undefined,
    maxWarmP95Ms: positiveNumber(
      environment.PERF_MAX_WARM_P95_MS,
      800,
      "PERF_MAX_WARM_P95_MS"
    )
  };
}

export function evaluateNavigationBudget(
  results: Array<Pick<NavigationRouteResult, "route" | "warm">>,
  maxWarmP95Ms: number
): { passed: boolean; failingRoutes: string[] } {
  const failingRoutes = results
    .filter((result) => result.warm.p95Ms > maxWarmP95Ms)
    .map((result) => result.route);
  return { passed: failingRoutes.length === 0, failingRoutes };
}

async function measureRequest(
  url: string,
  cookie: string | undefined,
  fetchImplementation: typeof fetch
) {
  const startedAt = performance.now();
  const response = await fetchImplementation(url, {
    cache: "no-store",
    redirect: "manual",
    headers: cookie ? { cookie } : undefined
  });
  const headersAt = performance.now();
  await response.arrayBuffer();
  const completedAt = performance.now();

  return {
    status: response.status,
    ttfbMs: roundMs(headersAt - startedAt),
    totalMs: roundMs(completedAt - startedAt)
  };
}

export async function runNavigationBenchmark(
  config: NavigationBenchmarkConfig,
  fetchImplementation: typeof fetch = fetch
): Promise<NavigationRouteResult[]> {
  const results: NavigationRouteResult[] = [];

  for (const route of config.routes) {
    const url = new URL(route, `${config.baseUrl}/`).toString();
    const cold = await measureRequest(url, config.cookie, fetchImplementation);
    const warmDurations: number[] = [];

    for (let iteration = 1; iteration < config.iterations; iteration += 1) {
      const measurement = await measureRequest(url, config.cookie, fetchImplementation);
      warmDurations.push(measurement.totalMs);
    }

    results.push({
      route,
      cold,
      warm: summarizeDurations(warmDurations)
    });
  }

  return results;
}

async function main(): Promise<void> {
  const config = parseNavigationBenchmarkConfig(process.env);
  const results = await runNavigationBenchmark(config);
  const budget = evaluateNavigationBudget(results, config.maxWarmP95Ms);

  console.log(JSON.stringify({
    baseUrl: config.baseUrl,
    iterations: config.iterations,
    maxWarmP95Ms: config.maxWarmP95Ms,
    results,
    budget
  }, null, 2));

  if (!budget.passed) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
