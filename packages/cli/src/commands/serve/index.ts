/**
 * enact serve command
 *
 * Start a self-hosted Enact registry server.
 * Uses SQLite + local file storage — no external dependencies.
 */

import { resolve } from "node:path";
import type { Command } from "commander";

export function configureServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Start a self-hosted Enact registry server")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .option("-d, --data <path>", "Data directory for storage", "./registry-data")
    .option("--host <host>", "Host to bind to", "0.0.0.0")
    .action(async (options: { port: string; data: string; host: string }) => {
      const { startServer } = await import("@enactprotocol/registry");
      await startServer({
        port: Number.parseInt(options.port, 10),
        dataDir: resolve(options.data),
        host: options.host,
      });
    });
}
