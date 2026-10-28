import { notFound } from "next/navigation";

import BulkEntryPrototype from "./prototype-client";

export default function BulkEntryPrototypePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BulkEntryPrototype />;
}
