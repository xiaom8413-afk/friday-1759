// Optional developer utility. The generated HTML requires no runtime or install.
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${read('style.css')}\n</style>`);
for (const file of ['engine.js', 'art.js', 'renderer.js', 'systems.js', 'game.js']) {
  html = html.replace(`<script src="${file}"></script>`, () => `<script>\n${read(file).replace(/<\/script/gi, '<\\/script')}\n</script>`);
}
const target = path.join(__dirname, '周五1759.html');
fs.writeFileSync(target, html);
console.log(`Created ${target} (${Buffer.byteLength(html)} bytes)`);
