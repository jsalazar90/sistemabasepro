import fs from 'fs';

let code = fs.readFileSync('src/services/db.ts', 'utf8');

// Undo the empty variable names issue
// we know that the next line usually has the variable name
// e.g. "if (!local || local.length === 0)"
// Let's just do a smarter regex

code = code.replace(/const\s+=\s+await getLocal(<[^>]+>)?\([^,]+,\s*(?:\[\]|\{\}|DEFAULT[^)]+)\);?\s*(?:\n\s*if \(!(\w+)|(?:\n\s*(?:return|updatedList = \[\.\.\.|const existingIdx = )(\w+)))/g, (match, type, var1, var2) => {
    const varName = var1 || var2 || 'list';
    return match.replace(/const\s+=/, `const ${varName} =`);
});

fs.writeFileSync('src/services/db.ts', code);
