/**
 * enact org command
 *
 * Manage organizations for @org scoped tool namespaces.
 *
 * Subcommands:
 *   - create: Create a new organization
 *   - info: Show organization details
 *   - list: List your organizations (TODO: requires user orgs endpoint)
 *   - add-member: Add a member to an organization
 *   - remove-member: Remove a member from an organization
 *   - set-role: Change a member's role
 */

import {
  addOrgMember,
  createApiClient,
  createOrg,
  getOrg,
  listOrgMembers,
  removeOrgMember,
  updateOrgMemberRole,
} from "@enactprotocol/api";
import { getSecret } from "@enactprotocol/secrets";
import { loadConfig } from "@enactprotocol/shared";
import type { OrgRole } from "@enactprotocol/shared";
import type { Command } from "commander";
import type { GlobalOptions } from "../../types";
import {
  type TableColumn,
  dim,
  error,
  formatError,
  header,
  json,
  keyValue,
  newline,
  success,
  table,
} from "../../utils";

const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";

const VALID_ROLES = ["owner", "admin", "member"] as const;

async function getClient() {
  const config = loadConfig();
  const token = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
  return createApiClient({
    baseUrl: config.registry?.url,
    authToken: token ?? undefined,
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function createHandler(
  name: string,
  options: { displayName?: string; description?: string } & GlobalOptions
) {
  try {
    const client = await getClient();
    const org = await createOrg(client, {
      name,
      displayName: options.displayName,
      description: options.description,
    });

    if (options.json) {
      json(org);
      return;
    }

    success(`Organization "@${org.name}" created`);
    newline();
    keyValue("Name", `@${org.name}`);
    if (org.display_name) keyValue("Display Name", org.display_name);
    if (org.description) keyValue("Description", org.description);
    newline();
    dim("You are the owner. Publish tools with:");
    dim(`  enact publish  (with name: "@${org.name}/your-tool" in SKILL.md)`);
  } catch (err) {
    error(formatError(err));
    process.exit(1);
  }
}

async function infoHandler(name: string, options: GlobalOptions) {
  try {
    // Strip @ prefix if provided
    const orgName = name.startsWith("@") ? name.substring(1) : name;
    const client = await getClient();

    const org = await getOrg(client, orgName);
    const members = await listOrgMembers(client, orgName);

    if (options.json) {
      json({ ...org, members });
      return;
    }

    header(`@${org.name}`);
    if (org.display_name) keyValue("Display Name", org.display_name);
    if (org.description) keyValue("Description", org.description);
    keyValue("Tools", String(org.tool_count));
    keyValue("Members", String(org.member_count));
    keyValue("Created", org.created_at);

    newline();
    header("Members");
    const columns: TableColumn[] = [
      { header: "Username", key: "username", width: 20 },
      { header: "Role", key: "role", width: 10 },
      { header: "Added", key: "added_at", width: 20 },
    ];
    table(
      members.map((m) => ({
        username: m.username,
        role: m.role,
        added_at: m.added_at,
      })),
      columns
    );
  } catch (err) {
    error(formatError(err));
    process.exit(1);
  }
}

async function addMemberHandler(
  orgName: string,
  username: string,
  options: { role?: string } & GlobalOptions
) {
  try {
    const org = orgName.startsWith("@") ? orgName.substring(1) : orgName;
    const role = (options.role ?? "member") as OrgRole;

    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}`);
      process.exit(1);
    }

    const client = await getClient();
    await addOrgMember(client, org, { username, role });

    if (options.json) {
      json({ username, role, org });
      return;
    }

    success(`Added "${username}" to @${org} as ${role}`);
  } catch (err) {
    error(formatError(err));
    process.exit(1);
  }
}

async function removeMemberHandler(orgName: string, username: string, options: GlobalOptions) {
  try {
    const org = orgName.startsWith("@") ? orgName.substring(1) : orgName;
    const client = await getClient();
    await removeOrgMember(client, org, username);

    if (options.json) {
      json({ removed: username, org });
      return;
    }

    success(`Removed "${username}" from @${org}`);
  } catch (err) {
    error(formatError(err));
    process.exit(1);
  }
}

async function setRoleHandler(
  orgName: string,
  username: string,
  role: string,
  options: GlobalOptions
) {
  try {
    const org = orgName.startsWith("@") ? orgName.substring(1) : orgName;

    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}`);
      process.exit(1);
    }

    const client = await getClient();
    await updateOrgMemberRole(client, org, username, role as OrgRole);

    if (options.json) {
      json({ username, role, org });
      return;
    }

    success(`Set "${username}" role to ${role} in @${org}`);
  } catch (err) {
    error(formatError(err));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Command Configuration
// ---------------------------------------------------------------------------

export function configureOrgCommand(program: Command): void {
  const org = program.command("org").description("Manage organizations (@org scoped namespaces)");

  // enact org create <name>
  org
    .command("create <name>")
    .description("Create a new organization")
    .option("--display-name <name>", "Display name for the organization")
    .option("--description <desc>", "Organization description")
    .option("--json", "Output as JSON")
    .action(async (name: string, options) => {
      await createHandler(name, options);
    });

  // enact org info <name>
  org
    .command("info <name>")
    .description("Show organization details and members")
    .option("--json", "Output as JSON")
    .action(async (name: string, options) => {
      await infoHandler(name, options);
    });

  // enact org add-member <org> <username>
  org
    .command("add-member <org> <username>")
    .description("Add a member to an organization")
    .option("--role <role>", "Member role (owner, admin, member)", "member")
    .option("--json", "Output as JSON")
    .action(async (orgName: string, username: string, options) => {
      await addMemberHandler(orgName, username, options);
    });

  // enact org remove-member <org> <username>
  org
    .command("remove-member <org> <username>")
    .description("Remove a member from an organization")
    .option("--json", "Output as JSON")
    .action(async (orgName: string, username: string, options) => {
      await removeMemberHandler(orgName, username, options);
    });

  // enact org set-role <org> <username> <role>
  org
    .command("set-role <org> <username> <role>")
    .description("Change a member's role (owner, admin, member)")
    .option("--json", "Output as JSON")
    .action(async (orgName: string, username: string, role: string, options) => {
      await setRoleHandler(orgName, username, role, options);
    });
}
