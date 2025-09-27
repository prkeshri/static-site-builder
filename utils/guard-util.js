import { INJECTIONS } from "../config-init/build-config.js";
import { guards } from "../config-init/guards.js";

Object.entries(guards).forEach(([k, v]) => {
    const ik = k.substring(1) + '/*';
    const existing = INJECTIONS[ik] ?? [];
    existing.push({
        OUTPUT: 'dist' + v.out ?? v,
    });
    INJECTIONS[ik] = existing;
});
