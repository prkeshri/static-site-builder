// Common util to throw with optional filename
function throwTagError(tag, filename) {
    const fileInfo = filename ? ` in file "${filename}"` : "";
    throw new Error(`No ${tag} tag found${fileInfo}`);
}

// Inject a partial before </body>
function injectBeforeBodyClose(pageHtml, partialHtml, filename) {
    const re = /<\/body\s*>/i;
    if (!re.test(pageHtml)) {
        throwTagError("</body>", filename);
    }
    return pageHtml.replace(re, `${partialHtml}\n</body>`);
}

// Inject a partial before </head>
function injectBeforeHeadClose(pageHtml, partialHtml, filename) {
    const re = /<\/head\s*>/i;
    if (!re.test(pageHtml)) {
        throwTagError("</head>", filename);
    }
    return pageHtml.replace(re, `${partialHtml}\n</head>`);
}

// Inject a partial right after <body ...>
function injectAfterBodyOpen(pageHtml, partialHtml, filename) {
    const re = /<body(\s[^>]*)?>/i;
    if (!re.test(pageHtml)) {
        throwTagError("<body>", filename);
    }
    return pageHtml.replace(re, match => `${match}\n${partialHtml}`);
}

// Inject a partial right after <head ...>
function injectAfterHeadOpen(pageHtml, partialHtml, filename) {
    const re = /<head(\s[^>]*)?>/i;
    if (!re.test(pageHtml)) {
        throwTagError("<head>", filename);
    }
    return pageHtml.replace(re, match => `${match}\n${partialHtml}`);
}


export const injectors = {
    PRE_BODY_CLOSE: injectBeforeBodyClose,
    PRE_HEAD_CLOSE: injectBeforeHeadClose,
    POST_BODY_OPEN: injectAfterBodyOpen,
    POST_HEAD_OPEN: injectAfterHeadOpen,
};
