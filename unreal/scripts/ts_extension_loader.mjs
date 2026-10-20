// Node 24 strips TypeScript types but does not resolve extensionless TS imports by default.
// This small loader keeps scripts/export-npcs.ts working with the project's current imports.
import fs from 'node:fs';
import path from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !path.extname(specifier)) {
    const parent = context.parentURL && new URL(context.parentURL);
    if (parent && parent.protocol === 'file:') {
      const candidate = new URL(specifier + '.ts', parent);
      if (fs.existsSync(candidate)) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
}
