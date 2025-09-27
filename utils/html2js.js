export function html2js(src) {
    src = src.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\\$");
    // minimal escaping for backticks and \:
    const esm = `export default \`\n${src}\n\`;\n`;
    return esm;
}
