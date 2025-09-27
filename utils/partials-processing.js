import fs from 'node:fs';
import path from 'path';

export function processPartials(html, partialsCache, filename) {
    if (!html || typeof html !== "string") return html;

    return html.replace(/@PARTIAL\(([^)]+)\)/g, (_, name) => {
        const key = name.trim();
        // return the partial content if found, else leave placeholder as-is
        let value = partialsCache.get(key);
        if (!value) {
            throw new Error(`<!-- Missing partial: ${key} --> for ${filename}`);
        }

        recordPartialToMain(key, filename);
        return value;
    });
}

const partialToMainMap = {};
export function recordPartialToMain(key, filename) {
    partialToMainMap[key] = partialToMainMap[key] ?? [];
    partialToMainMap[key].push(filename);
}
recordPartialToMain.save = () => {
    const dir = 'dev';
    if (!fs.existsSync(dir)) return false; // dev folder doesn't exist → no-op

    const file = path.join(dir, 'partial-to-main.json');
    const content = JSON.stringify(partialToMainMap, null, 2);

    fs.writeFileSync(file, content, 'utf8');
    return true;
};
