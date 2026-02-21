/**
 * skill.package.yaml template for default init
 */
export const defaultSkillPackageTemplate = `enact: "2.0.0"
name: {{TOOL_NAME}}
version: "0.1.0"
description: A simple tool that echoes a greeting
from: python:3.12-slim

scripts:
  greet: "python /workspace/hello.py {{name}}"
`;
