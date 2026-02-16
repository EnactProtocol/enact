/**
 * Self-hosted Enact Registry Server
 *
 * SQLite + local file storage. No external dependencies.
 * Start with: enact serve --port 3000 --data ./registry-data
 */

import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { closeDatabase, initDatabase } from "./db.js";
import { auth } from "./routes/auth.js";
import { orgs } from "./routes/orgs.js";
import { tools } from "./routes/tools.js";
import { initStorage } from "./storage.js";

export interface RegistryServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
}

export function createApp(dataDir: string): Hono {
  // Initialize database and storage
  initDatabase(dataDir);
  initStorage(dataDir);

  const app = new Hono();

  // Middleware
  app.use("*", cors());
  app.use("*", logger());

  // Health check
  app.get("/health", (c) => c.json({ status: "ok", version: "2.2.4" }));

  // Mount routes
  app.route("/tools", tools);
  app.route("/orgs", orgs);
  app.route("/auth", auth);

  return app;
}

export async function startServer(options: RegistryServerOptions = {}): Promise<void> {
  const port = options.port ?? 3000;
  const host = options.host ?? "0.0.0.0";
  const dataDir = resolve(options.dataDir ?? "./registry-data");

  const app = createApp(dataDir);

  console.log("\n  Enact Registry Server");
  console.log("  ────────────────────");
  console.log(`  Data:     ${dataDir}`);
  console.log(`  Listen:   http://${host}:${port}`);
  console.log(
    `  API key:  ${process.env.ENACT_REGISTRY_API_KEY ? "configured" : "none (open mode)"}`
  );
  console.log("\n  Point your CLI at this registry:");
  console.log(`    enact config set registry.url http://localhost:${port}\n`);

  serve({ fetch: app.fetch, port, hostname: host }, (info) => {
    console.log(`  Listening on http://${info.address}:${info.port}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n  Shutting down...");
    closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export { initDatabase, closeDatabase } from "./db.js";
export { initStorage } from "./storage.js";
