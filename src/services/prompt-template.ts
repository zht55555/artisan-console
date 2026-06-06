const TEMPLATE_VAR_REGEX = /\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g;

export function extractTemplateVariables(template: string): string[] {
  const vars = new Set<string>();
  const regex = new RegExp(TEMPLATE_VAR_REGEX);
  let match = regex.exec(template);

  while (match) {
    vars.add(match[1]);
    match = regex.exec(template);
  }

  return Array.from(vars).sort((a, b) => a.localeCompare(b));
}

export function applyTemplateVariables(
  template: string,
  values: Record<string, string | number | boolean>,
) {
  const missing = new Set<string>();
  const regex = new RegExp(TEMPLATE_VAR_REGEX);

  const rendered = template.replace(regex, (_full, key: string) => {
    const value = values[key];
    if (value === undefined || value === null || String(value).length === 0) {
      missing.add(key);
      return "";
    }

    return String(value);
  });

  return {
    rendered,
    missingVariables: Array.from(missing).sort((a, b) => a.localeCompare(b)),
  };
}
