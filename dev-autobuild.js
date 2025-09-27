import chokidar from "chokidar";
import { exec } from "child_process";
import fs from 'fs';
import path from 'path';
import { mainToPartials } from "./config-init/build-config.js";

const mainAsPartials = (() => {
    const m = {};
    Object.entries(mainToPartials).forEach(([k, v]) => {
        m[v] = k;
    });
    return m;
})();

const mainDir = "./src/main";
const partialsDir = "./src/partials";
// 📍 Directories to watch
const watchDirs = [mainDir, partialsDir]; // <-- change this path

// 💻 Command to run on file change
const commandToRun = "npm run build"; // <-- change this

// 🕵️ Setup watcher
const watcher = chokidar.watch(watchDirs, {
    ignored: /(^|[\/\\])\../,   // ignore dotfiles
    persistent: true,
    ignoreInitial: true,        // don't fire on startup for existing files
});

// ⚡ On any change (add/change/unlink)
watcher.on("all", (event, filepath) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${event.toUpperCase()}: ${filepath}`);

    if (filepath.includes('partials')) {
        rebuild(filepath, listRebuildsForPartial(filepath));
    } else {
        const canBePartial = path.relative(mainDir, filepath);
        const list = [filepath];
        // Platform Independent
        const canBePartialPI = canBePartial.replaceAll('\\', '\/');
        if (mainAsPartials[canBePartialPI]) {
            list.push(...listRebuildsForPartial(canBePartial));
        }
        rebuild(filepath, list);
    }
});

console.log(`👀 Watching for changes in ${watchDirs.join(', ')}...`);

function listRebuildsForPartial(key) {
    const file = path.join('dev', 'partial-to-main.json');
    if (!fs.existsSync(file)) {
        console.error('Mapping file not found:', file);
        return [];
    }

    const raw = fs.readFileSync(file, 'utf8');
    let partialToMainMap;
    try {
        partialToMainMap = JSON.parse(raw);
    } catch (err) {
        console.error('Error parsing JSON:', err);
        return [];
    }
    let k = path.relative(partialsDir, key)
    k = path.basename(k, path.extname(k));;
    const values = partialToMainMap[k];
    if (!values || values.length === 0) {
        console.log(`No entries found for key: ${k}`);
        return [];
    }
    // Ensure values is iterable
    const arr = Array.isArray(values) ? values : [values];
    const filepaths = arr.map(v => {
        const p = path.join(mainDir, v);
        return p;
    });
    return filepaths;
}

const timeouts = {};
function rebuild(key, filepaths) {
    if (!Array.isArray(filepaths)) filepaths = [filepaths];
    clearTimeout(timeouts[key]);
    timeouts[key] = setTimeout(() => {
        const cmd = commandToRun + ' -- ' + filepaths.join(' ');
        console.log(`🚀 Running command...${cmd}`);
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`⚠️ Stderr: ${stderr}`);
            }
            console.log(`✅ Command output:\n${stdout}`);
        });
    }, 1000);// waits 1000 ms after the last change
}

