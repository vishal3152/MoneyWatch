import { vi } from "vitest";

// Server Action unit tests call revalidateTag outside a Next request.
// Production code still uses the real APIs; tests that care about invalidation inject deps.revalidate.
vi.mock("next/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/cache")>();
  return {
    ...actual,
    revalidateTag: vi.fn()
  };
});
