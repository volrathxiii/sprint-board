// Usage: node .claude/skills/sprint-board/scripts/check.js <page.html>
// Syntax-checks the page script and renders it against a stub DOM, so a broken
// data block is caught before publishing. Prints a one-line summary and the update text.
const fs = require("fs"), vm = require("vm");
const html = fs.readFileSync(process.argv[2], "utf8");
const js = html.split("<script>").pop().split("</script>")[0];
try { new vm.Script(js); } catch (e) { console.error("SYNTAX ERROR:", e.message); process.exit(1); }
const els = {}, made = [];
const mk = () => new Proxy({ innerHTML: "", textContent: "", value: "", style: {}, dataset: {},
  classList: { add() {}, remove() {}, toggle() {} } },
  { get: (o, k) => (k in o ? o[k] : () => mk()), set: (o, k, v) => ((o[k] = v), true) });
const ctx = {
  document: { getElementById: id => els[id] || (els[id] = mk()), querySelectorAll: () => [],
    querySelector: () => mk(), addEventListener() {}, createElement: () => { const e = mk(); made.push(e); return e; },
    documentElement: mk() },
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
  navigator: { clipboard: { writeText: async () => {} } }, setTimeout, console,
};
try { vm.runInNewContext(js, ctx); } catch (e) { console.error("RENDER ERROR:", e.stack); process.exit(1); }
const all = made.map(e => e.innerHTML).join("");
const n = re => (all.match(re) || []).length;
console.log(`OK · ${els.eyebrow?.textContent} · cards ${n(/<article/g)} · asks open ${n(/class="asked">asked/g)} · not asked ${n(/asked not/g)} · answered ${n(/asked ans/g)} · to do ${n(/>to do</g)}`);
console.log("---\n" + (els.update?.value || "(no update text)"));
