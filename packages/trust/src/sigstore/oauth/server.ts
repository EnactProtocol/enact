/**
 * OAuth Callback Server
 *
 * A simple HTTP server that receives the OAuth redirect callback
 * after the user authenticates in their browser.
 */

import http from "node:http";
import type { Socket } from "node:net";

interface CallbackServerOptions {
  port: number;
  hostname: string;
}

/**
 * CallbackServer is a simple HTTP server which receives the OAuth
 * redirect from the OAuth provider after the user signs-in. It will shutdown
 * once the callback is received and the callback promise will resolve with
 * the URL of the incoming request.
 */
export class CallbackServer {
  private server: http.Server;
  private sockets: Set<Socket>;
  private port: number;
  private hostname: string;

  public callback: Promise<string> | undefined;

  constructor(options: CallbackServerOptions) {
    this.server = http.createServer();
    this.sockets = new Set<Socket>();
    this.port = options.port;
    this.hostname = options.hostname;
  }

  async start(): Promise<string> {
    await new Promise<void>((resolve) => {
      this.server.listen(this.port, this.hostname, resolve);
    });

    // Keep track of connections so we can force a shutdown
    this.server.on("connection", (socket) => {
      this.sockets.add(socket);
      socket.on("close", () => {
        this.sockets.delete(socket);
      });
    });

    // The callback will resolve with the incoming request URL
    this.callback = new Promise<string>((resolve) => {
      this.server.on("request", ({ url }, res) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(AUTH_SUCCESS_HTML);

        // Shutdown the server and resolve the callback promise
        this.shutdown().then(() => resolve(url!));
      });
    });

    // Calculate and return the URL which can be used to reach the server
    return this.serverURL(this.server);
  }

  public async shutdown(): Promise<void> {
    // Destroy all sockets and close the server
    return new Promise<void>((resolve) => {
      for (const socket of this.sockets) {
        socket.destroy();
        this.sockets.delete(socket);
      }
      this.server.close(() => resolve());
    });
  }

  private serverURL(server: http.Server): string {
    const address = server.address();
    if (address === null) {
      throw new Error("invalid server config: address is null");
    }
    if (typeof address === "string") {
      throw new Error("invalid server config: address is a string");
    }

    return `http://${this.hostname}:${address.port}`;
  }
}

// Success HTML page shown after authentication
const AUTH_SUCCESS_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <title>Enact - Authentication Successful</title>
    <style>
      :root { font-family: system-ui, -apple-system, sans-serif; }
      body { 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        min-height: 100vh; 
        margin: 0; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      .container { 
        background: white; 
        padding: 3rem; 
        border-radius: 1rem; 
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        text-align: center;
        max-width: 400px;
      }
      .checkmark {
        width: 80px;
        height: 80px;
        margin: 0 auto 1.5rem;
        background: #10b981;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .checkmark svg {
        width: 40px;
        height: 40px;
        stroke: white;
        stroke-width: 3;
        fill: none;
      }
      h1 { 
        color: #1f2937; 
        margin: 0 0 0.5rem; 
        font-size: 1.5rem;
      }
      p { 
        color: #6b7280; 
        margin: 0;
        font-size: 1rem;
      }
      .brand {
        margin-top: 2rem;
        color: #9ca3af;
        font-size: 0.875rem;
      }
      .brand strong {
        color: #667eea;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="checkmark">
        <svg viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h1>Authentication Successful!</h1>
      <p>You may now close this window and return to your terminal.</p>
      <p class="brand">Signed with <strong>Sigstore</strong> via <strong>Enact</strong></p>
    </div>
  </body>
</html>
`;
