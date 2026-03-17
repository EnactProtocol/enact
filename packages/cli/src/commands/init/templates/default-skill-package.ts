/**
 * skill.package.yaml template for default init
 */
export const defaultSkillPackageTemplate = `name: {{TOOL_NAME}}
version: "0.1.0"
description: A simple tool that echoes a greeting
from: python:3.12-slim

scripts:
  default: "python /workspace/hello.py"
`;
