import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import toml from "toml";
import { REPLACEMENTS } from "../config-init/build-config.js";
import { config as initConfig } from "../config-init/config.js";

function loadWranglerVars(file = "wrangler.toml") {
    const vars = {};
    const tomlPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(tomlPath)) {
        console.warn(`[wrangler-vars] ${file} not found`);
        return vars;
    }

    const raw = fs.readFileSync(tomlPath, "utf8");
    const config = toml.parse(raw);

    // top-level vars
    if (config.vars) {
        Object.entries(config.vars).forEach(([key, value]) => {
            if (!process.env[key]) {
                vars[key] = process.env[key] = String(value);
            } else {
                vars[key] = process.env[key]
            }
        });
    }

    return vars;
}

const vars = loadWranglerVars();

export const env = process.env;
const NODE_ENV = env.NODE_ENV = env.NODE_ENV || 'dev';
console.log(`Using env: ${NODE_ENV}`);

let envFile;
if (NODE_ENV !== 'dev') {
    envFile = `.env.${process.env.NODE_ENV}`;
} else {
    envFile = `.env`;
}

const uEnv = dotenv.config({ path: envFile, override: true }).parsed ?? {};

function addReplacements(obj, resps = [], cb = () => { }) {
    Object.entries(obj).forEach(([k, v]) => {
        const key = `[${k}]`;
        REPLACEMENTS[key] = v;
        resps.push(`${key}`);
    });
    cb(resps);
}

addReplacements(vars, [], (resps) => {
    console.log("Added from toml: ", resps.join(', '));
});
addReplacements(uEnv, [], (resps) => {
    console.log(`Added from ${envFile}: `, resps.join(', '));
});


export const config = (() => {
    const c = { ...vars, ...uEnv };
    Object.entries(initConfig).forEach(([k, v]) => {
        let i = 0, j = 0;
        if (k.startsWith('[')) i++;
        if (k.endsWith(']')) j++;
        c[k.substring(i, k.length - i)] = v;
    });
    return c;
})();

