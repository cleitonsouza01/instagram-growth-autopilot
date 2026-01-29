import { db } from "../storage/database";
import { logger } from "../utils/logger";

/**
 * DM template management with variable substitution.
 */

export interface DMTemplate {
  id?: number;
  name: string;
  category: "welcome" | "collaboration" | "faq" | "custom";
  body: string;
  variables: string[]; // Extracted from body: {username}, {fullname}, etc.
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

const VARIABLE_REGEX = /\{(\w+)\}/g;

/**
 * Extract variable names from a template body.
 */
export function extractVariables(body: string): string[] {
  const matches = body.matchAll(VARIABLE_REGEX);
  const vars = new Set<string>();
  for (const match of matches) {
    vars.add(match[1]!);
  }
  return Array.from(vars);
}

/**
 * Substitute variables in a template body.
 */
export function substituteVariables(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(VARIABLE_REGEX, (match, name: string) => {
    return values[name] ?? match;
  });
}

/**
 * Create a new DM template.
 */
export async function createTemplate(
  template: Omit<DMTemplate, "id" | "variables" | "createdAt" | "updatedAt" | "usageCount">,
): Promise<number> {
  const now = Date.now();
  const variables = extractVariables(template.body);

  const entry: Omit<DMTemplate, "id"> = {
    ...template,
    variables,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };

  const id = await db.table("dmTemplates").add(entry);
  logger.info("dm-templates", `Template created: "${template.name}" (id: ${id})`);
  return typeof id === "number" ? id : Number(id);
}

/**
 * Update an existing DM template.
 */
export async function updateTemplate(
  id: number,
  updates: Partial<Pick<DMTemplate, "name" | "category" | "body">>,
): Promise<void> {
  const patch: Record<string, unknown> = { ...updates, updatedAt: Date.now() };
  if (updates.body) {
    patch["variables"] = extractVariables(updates.body);
  }
  await db.table("dmTemplates").update(id, patch);
}

/**
 * Delete a DM template.
 */
export async function deleteTemplate(id: number): Promise<void> {
  await db.table("dmTemplates").delete(id);
}

/**
 * Get all DM templates, optionally filtered by category.
 */
export async function getTemplates(
  category?: DMTemplate["category"],
): Promise<DMTemplate[]> {
  if (category) {
    return db.table("dmTemplates").where("category").equals(category).toArray();
  }
  return db.table("dmTemplates").orderBy("name").toArray();
}

/**
 * Record template usage.
 */
export async function recordTemplateUsage(id: number): Promise<void> {
  const template = await db.table("dmTemplates").get(id);
  if (template) {
    await db.table("dmTemplates").update(id, {
      usageCount: (template as DMTemplate).usageCount + 1,
    });
  }
}
