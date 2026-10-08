import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { prisma } from "./src/lib/prisma.ts";
async function check() {
  const dups = await prisma.perfume.groupBy({
    by: ["brand", "name"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  console.log(JSON.stringify(dups, null, 2));
}
check();