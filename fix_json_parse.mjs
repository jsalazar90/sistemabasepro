import fs from 'fs';

let code = fs.readFileSync('src/services/db.ts', 'utf8');

// The code looks like:
// const local = await getLocal<any[]>('...', []);
// const fallback = local ? JSON.parse(local) : [];
// We should replace `JSON.parse(local)` with `local` because local is already an array now.

code = code.replace(/JSON\.parse\((local|localList|existing|list)\)/g, '$1');

// Wait, the string 'typeof local === "string" ? JSON.parse(local) : local' is better but it's okay.
fs.writeFileSync('src/services/db.ts', code);
