#!/usr/bin/env node
import fsp from 'node:fs/promises';
import path from 'node:path';
// import ejs from 'ejs';

import { REPLACEMENTS, INJECTIONS, mainToPartials } from './config-init/build-config.js';
import { injectors } from './utils/injectors.js';
import { config, env } from './utils/env-loading.js';
import { recordPartialToMain, processPartials } from './utils/partials-processing.js';
import "./utils/guard-util.js";

const indivFiles = process.argv.slice(2);

const MAIN_DIR = 'src/main';
const PARTIALS_DIR = 'src/partials';
const OUT_DIR = 'dist';

// Resolve $KEY aliases directly from REPLACEMENTS.KEY
function resolveAliases(cfg) {
    const out = {};
    for (const [k, v] of Object.entries(cfg)) {
        if (typeof v === 'string' && v.startsWith('$') && v.length > 1) {
            const ref = v.slice(1);
            if (!(ref in cfg)) throw new Error(`Alias ${v} for key "${k}" not found in REPLACEMENTS`);
            out[k] = cfg[ref];
        } else {
            out[k] = v;
        }
    }
    return out;
}

/**
 * Replace by iterating entries and using String.prototype.replaceAll (no regex).
 * Keys are used literally (can include brackets or not).
 * Throws if any key maps to undefined (shouldn’t happen after resolveAliases).
 */
function replaceTokens(html, resolvedMap) {
    let out = html;
    for (const [needle, replacement] of Object.entries(resolvedMap)) {
        if (needle === '') continue;
        // Use literal replaceAll
        out = out.replaceAll(needle, replacement);
    }
    return out;
}

// Walk pages recursively
async function* walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) yield* walk(full);
        else yield full;
    }
}

function shouldProcess(fileName) {
    if (fileName.endsWith('.html') || fileName.endsWith('.htm') || fileName === '_redirects' || fileName.endsWith('.js') || fileName.endsWith('.js.download') || fileName.endsWith('.webmanifest')) {
        return true;
    }
    return false;
}

function getRulesFor(rel) {
    const rules = [];
    const prefix = rel.split('/')[0] + '/*'
    const suffix = '*.' + rel.split('.').pop();
    const rulesSrc = [INJECTIONS[rel], INJECTIONS[prefix], INJECTIONS[suffix], INJECTIONS['*']];
    rulesSrc.forEach(ruleSrc => {
        if (!ruleSrc) {
            return;
        }

        const r = ruleSrc.filter(r => !r.skip || !r.skip.includes(rel))
        rules.push(...r);
    });

    return rules;
}

function ejsRender(html) {
    const processed = ejs.render(html, { config, env });
    return processed;
}

async function main() {
    const processed = {};
    const replacements = resolveAliases(REPLACEMENTS);

    // 1) Load & cache partials (token-replaced)
    const partialsCache = new Map();
    try {
        const entries = await fsp.readdir(PARTIALS_DIR, { withFileTypes: true });
        for (const e of entries) {
            if (!e.isFile() || !e.name.endsWith('.html')) continue;
            const abs = path.join(PARTIALS_DIR, e.name);
            const key = path.basename(e.name, path.extname(e.name));
            let html = await fsp.readFile(abs, 'utf8');
            html = replaceTokens(html, replacements);
            partialsCache.set(key, html);
        }

        for (const [key, v] of Object.entries(mainToPartials)) {
            const abs = path.join(MAIN_DIR, v);
            const html = await processAbsolutePath(abs);
            partialsCache.set(key, html);
        }
    } catch (e) {
        if (e.code !== 'ENOENT') throw e; // partials dir may not exist; that's fine
    }

    if (indivFiles.length) {
        for (const abs of indivFiles) {
            await processAbsolutePath(abs);
        }
        console.log('\n✅ Individual Builds complete.');
        return;
    }
    // 2) Process pages recursively (exact-match INJECTIONS keys only)
    for await (const abs of walk(MAIN_DIR)) {
        await processAbsolutePath(abs);
    }

    recordPartialToMain.save();
    console.log('\n✅ Build complete.');

    async function processAbsolutePath(abs) {
        if (processed[abs]) {
            return;
        }
        processed[abs] = true;
        const rel = path.relative(MAIN_DIR, abs).replace(/\\/g, '/'); // normalized
        let outPath = path.join(OUT_DIR, rel);

        const transforms = [];
        if (shouldProcess(rel)) {
            let html = await fsp.readFile(abs, 'utf8');
            if (html.startsWith('@ejs')) {
                transforms.push(ejsRender);
                html = html.substring(4).trimStart();
            }
            html = replaceTokens(html, replacements);
            html = processPartials(html, partialsCache, rel);

            const rules = getRulesFor(rel);
            if (rules?.[0]) {
                for (const rule of rules) {
                    for (const [key, injector] of Object.entries(injectors)) {
                        if (rule[key]) {
                            const processor = rule[key];
                            let part;

                            if (typeof processor === 'function') {
                                part = processor({ html, rule, env, partialsCache });
                            } else {
                                part = partialsCache.get(processor);
                                if (!part) throw new Error(`Partial "${processor}" not found for ${rel}`);
                                recordPartialToMain(processor, rel);
                            }

                            html = injector(html, part, rel);
                        }
                    }
                    if (rule.FIND) {
                        if (typeof rule.REPLACE_ALL === 'string') {
                            html = html.replaceAll(rule.FIND, rule.REPLACE_ALL);
                        } else {
                            html = html.replace(rule.FIND, rule.REPLACE);
                        }
                    }
                    if (rule.OUTPUT) {
                        outPath = path.join(rule.OUTPUT, rel);
                    }
                    if (rule.RENAME) {
                        outPath = rule.RENAME(outPath);
                    }
                    if (rule.TRANSFORM) {
                        transforms.push(rule.TRANSFORM);
                    }
                }
            }
            await fsp.mkdir(path.dirname(outPath), { recursive: true });

            for (const transform of transforms) {
                html = transform(html);
            }
            await fsp.writeFile(outPath, html, 'utf8');
            console.log('Built HTML:', rel);

            return html;
        } else {
            await fsp.mkdir(path.dirname(outPath), { recursive: true });
            // 🔁 copy non-HTML file as-is
            await fsp.copyFile(abs, outPath);
            console.log('Copied:', rel);
        }
    }
}

main().catch(err => {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
});
