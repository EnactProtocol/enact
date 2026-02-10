/**
 * Script-to-Action bridge
 *
 * Converts inline `scripts` from ToolManifest into Action/ActionsManifest
 * objects so the existing execution pipeline works unchanged.
 */

import type { JSONSchema7 } from "json-schema";
import { getActionCommandParams } from "../execution/action-command";
import type { Action, ActionEnvVars, ActionsManifest } from "../types/actions";
import type { ScriptDefinition, ToolManifest } from "../types/manifest";

/**
 * Convert a script command string to array form
 *
 * Splits on whitespace while preserving {{param}} tokens as single elements.
 */
function scriptCommandToArray(command: string): string[] {
  return command.split(/\s+/).filter((s) => s.length > 0);
}

/**
 * Auto-infer an inputSchema from {{param}} patterns in a command array
 *
 * Every parameter found becomes a required string property.
 */
function inferInputSchema(commandArray: string[]): JSONSchema7 {
  const params = getActionCommandParams(commandArray);

  if (params.length === 0) {
    return { type: "object", properties: {} };
  }

  const properties: Record<string, JSONSchema7> = {};
  for (const param of params) {
    properties[param] = { type: "string" };
  }

  return {
    type: "object",
    required: params,
    properties,
  };
}

/**
 * Convert a single script entry to an Action object
 */
export function scriptToAction(name: string, script: ScriptDefinition): Action {
  if (typeof script === "string") {
    const commandArray = scriptCommandToArray(script);
    return {
      description: name,
      command: commandArray,
      inputSchema: inferInputSchema(commandArray),
    };
  }

  // Expanded form
  const commandArray = scriptCommandToArray(script.command);
  return {
    description: script.description ?? name,
    command: commandArray,
    inputSchema: script.inputSchema ?? inferInputSchema(commandArray),
    ...(script.outputSchema && { outputSchema: script.outputSchema }),
    ...(script.annotations && { annotations: script.annotations }),
  };
}

/**
 * Convert manifest env (EnvVariables) to action env (ActionEnvVars)
 */
function convertEnv(env: ToolManifest["env"]): ActionEnvVars | undefined {
  if (!env || Object.keys(env).length === 0) return undefined;

  const actionEnv: ActionEnvVars = {};
  for (const [key, value] of Object.entries(env)) {
    const envVar: ActionEnvVars[string] = {
      description: value.description,
    };
    if (value.secret !== undefined) {
      envVar.secret = value.secret;
    }
    if (value.default !== undefined) {
      envVar.default = value.default;
    }
    actionEnv[key] = envVar;
  }
  return actionEnv;
}

/**
 * Convert all inline scripts from a manifest to an ActionsManifest
 *
 * Returns null if the manifest has no scripts.
 */
export function manifestScriptsToActionsManifest(manifest: ToolManifest): ActionsManifest | null {
  if (!manifest.scripts || Object.keys(manifest.scripts).length === 0) {
    return null;
  }

  const actions: Record<string, Action> = {};
  for (const [name, script] of Object.entries(manifest.scripts)) {
    actions[name] = scriptToAction(name, script);
  }

  const result: ActionsManifest = { actions };
  const env = convertEnv(manifest.env);
  if (env) {
    result.env = env;
  }
  if (manifest.hooks?.build) {
    result.build = manifest.hooks.build;
  }
  return result;
}
