import fs from 'fs';

let code = fs.readFileSync('src/services/db.ts', 'utf8');

// Replace localStorage.getItem with getLocal
code = code.replace(/localStorage\.getItem\(([^)]+)\)/g, 'await getLocal<any[]>($1, [])');

// Replace localStorage.setItem with setLocal
code = code.replace(/localStorage\.setItem\(([^,]+),\s*JSON\.stringify\(([^)]+)\)\)/g, 'await setLocal($1, $2)');

fs.writeFileSync('src/services/db.ts', code);
