import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postgresFactory = vi.hoisted(() =>
  vi.fn((connectionString: string, options?: unknown) => ({ connectionString, options }))
);

vi.mock("postgres", () => ({
  default: (connectionString: string, options?: unknown) =>
    postgresFactory(connectionString, options)
}));

describe("getPooledClient", () => {
  beforeEach(() => {
    postgresFactory.mockClear();
    delete (globalThis as { __moneyWatchPgPools?: unknown }).__moneyWatchPgPools;
  });

  afterEach(() => {
    delete (globalThis as { __moneyWatchPgPools?: unknown }).__moneyWatchPgPools;
  });

  it("reuses one client across multiple calls with the same connection string", async () => {
    const { getPooledClient } = await import("@/db/postgres/connection-pool");
    const a = getPooledClient("postgres://reuse-test");
    const b = getPooledClient("postgres://reuse-test");

    expect(a).toBe(b);
    expect(postgresFactory).toHaveBeenCalledTimes(1);
  });

  it("allows the dashboard's four-query read wave to run without pool queueing", async () => {
    const { getPooledClient } = await import("@/db/postgres/connection-pool");

    getPooledClient("postgres://dashboard-wave");

    expect(postgresFactory).toHaveBeenCalledWith(
      "postgres://dashboard-wave",
      expect.objectContaining({ max: 4 })
    );
  });

  it("creates separate clients for different connection strings", async () => {
    const { getPooledClient } = await import("@/db/postgres/connection-pool");
    const a = getPooledClient("postgres://separate-a");
    const c = getPooledClient("postgres://separate-b");

    expect(a).not.toBe(c);
    expect(postgresFactory).toHaveBeenCalledTimes(2);
  });

  it("reuses the same client after the module is reloaded (Fast Refresh)", async () => {
    const { getPooledClient: getBeforeReload } = await import("@/db/postgres/connection-pool");
    const before = getBeforeReload("postgres://hmr-test");

    vi.resetModules();

    const { getPooledClient: getAfterReload } = await import("@/db/postgres/connection-pool");
    const after = getAfterReload("postgres://hmr-test");

    expect(after).toBe(before);
    expect(postgresFactory).toHaveBeenCalledTimes(1);
  });
});
