import fs from 'fs';

let code = fs.readFileSync('src/services/db.ts', 'utf8');

// List of fixes based on tsc output
// We will simply regex find 'const local = await getLocal' in the specific lines or functions
// Actually, let's just do a blanket replacement in functions:
// If function is dbFetch*, it uses 'local'.
// If function is dbSaveEmpresa or dbDeleteEmpresa, it uses 'localList'.
// Otherwise, for other dbSave* and dbDelete* functions, it uses 'list'.
// For dbSaveConfiguracionContable, it uses 'existing'.

code = code.replace(/export async function (dbSaveEmpresa|dbDeleteEmpresa)[\s\S]*?(?=export async function|export function|$)/g, (match) => {
    return match.replace(/const (?:local|list) = await getLocal/g, 'const localList = await getLocal');
});

code = code.replace(/export async function (dbSaveConfiguracionContable)[\s\S]*?(?=export async function|export function|$)/g, (match) => {
    return match.replace(/const (?:local|list) = await getLocal/g, 'const existing = await getLocal');
});

code = code.replace(/export async function (dbSave(?!Empresa|ConfiguracionContable)\w+|dbDelete(?!Empresa)\w+)[\s\S]*?(?=export async function|export function|$)/g, (match) => {
    return match.replace(/const (?:local|localList) = await getLocal/g, 'const list = await getLocal');
});

// Also fix the return type syntax error in db.ts(1415,63):
// error TS1064: The return type of an async function or method must be the global Promise<T> type. Did you mean to write 'Promise<void>'?
code = code.replace(/export async function dbResetAllTestData\(empresaId\?: string\): void \{/, 'export async function dbResetAllTestData(empresaId?: string): Promise<void> {');
code = code.replace(/export async function dbLoadDefaultDataIfEmpty\(empresaId\?: string\): void \{/, 'export async function dbLoadDefaultDataIfEmpty(empresaId?: string): Promise<void> {');

fs.writeFileSync('src/services/db.ts', code);
