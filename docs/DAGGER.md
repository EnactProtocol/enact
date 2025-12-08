# Enact & Dagger: The Execution Engine

Enact leverages **Dagger** as its underlying runtime engine to guarantee **reproducible**, **sandboxed**, and **cache-efficient** execution of AI tools.

While Enact provides the protocol, discovery, and trust layers, Dagger handles the heavy lifting of container orchestration and execution.

## Why Dagger?

Enact's promise of "publish once, run anywhere" relies on Dagger's core capabilities:

1.  **Abstract the Environment:** Tools run in containers defined by code, ensuring they work identically on macOS, Linux, and Windows.
2.  **Guarantee Determinism:** Dagger uses a Directed Acyclic Graph (DAG) where every step is content-addressed. If the inputs (files, args, container hash) are the same, the output is guaranteed to be the same.
3.  **Smart Caching:** Dagger caches every operation. If you run a tool twice with the same inputs, the second run is instant because Dagger returns the cached result.
4.  **Programmatic Control:** Unlike static Dockerfiles, Dagger allows Enact to dynamically construct execution pipelines based on the `enact.md` configuration.

## How Enact Maps to Dagger

When you execute `enact run tool`, the CLI translates the `enact.md` manifest into a Dagger pipeline on the fly.

| Enact Manifest Field | Dagger API Equivalent | Description |
| :--- | :--- | :--- |
| `from: "python:3.11"` | `dag.Container().From("python:3.11")` | Sets the base container image. |
| `command: "python main.py"` | `.WithExec(["python", "main.py"])` | Executes the tool's logic. |
| `env: { API_KEY: ... }` | `.WithSecretVariable("API_KEY", secret)` | Injects secrets securely into memory. |
| Input Files | `.WithDirectory("/inputs", hostDir)` | Mounts user data into the sandbox. |
| Output Files | `.Directory("/outputs").Export()` | Extracts results back to the host. |

## Execution Flow

1.  **Parse:** The Enact CLI reads `enact.md` and validates the input arguments against the `inputSchema`.
2.  **Connect:** Enact connects to the local Dagger Engine (automatically starting it if necessary).
3.  **Construct:** A Dagger graph is built programmatically:
    *   **Base:** Pull the image specified in `from`.
    *   **Source:** Mount the tool's source code (from the installed tool bundle).
    *   **Inputs:** Mount user-provided files and inject arguments as environment variables.
    *   **Command:** Define the execution step using the `command` template.
4.  **Execute:** The graph is submitted to the engine.
    *   Dagger checks its cache for matching hashes.
    *   Missing steps are executed in isolated containers (using runc/containerd).
5.  **Output:** The standard output (stdout) is captured, and any output files are exported back to the user's workspace.

## Sandboxing & Security

Enact uses Dagger to enforce strict isolation policies:

*   **Filesystem Isolation:** Tools run in ephemeral containers. They cannot access the host filesystem (e.g., `~/.ssh`, `/etc`) unless a specific file or directory is explicitly passed as an input.
*   **Secret Safety:** Secrets are treated as special Dagger objects. They are mounted as environment variables only for the duration of the execution and are scrubbed from logs and cache keys.
*   **Network Control:** (Roadmap) Enact can utilize Dagger's capabilities to disable networking (`network: none`) for tools that are marked as "pure" data processors, preventing data exfiltration.

## Debugging with Dagger

The `enact exec` command exposes Dagger's interactive capabilities.

When you run:
```bash
enact exec alice/utils/greeter "/bin/sh"
```

Enact instructs Dagger to:
1.  Build the container environment exactly as defined in `enact.md`.
2.  Mount all sources and inputs.
3.  **Instead of running the defined command**, it opens an interactive terminal session inside that container.

This allows developers to inspect the exact environment the tool sees, debug file paths, and test commands manually.

## Performance Benefits

Because Dagger caches by content-addressable hashes:

*   **Shared Layers:** If multiple tools use `python:3.11`, the base image is stored once and shared.
*   **Dependency Caching:** If a tool has a build step (e.g., `npm install`), Dagger caches the `node_modules` directory. Subsequent runs are near-instant unless `package.json` changes.
*   **Result Caching:** For expensive operations (e.g., video processing), if the input file hasn't changed, Enact/Dagger returns the previous result immediately without re-running the computation.

---
*For more details on the underlying engine, visit [Dagger.io](https://dagger.io).*
