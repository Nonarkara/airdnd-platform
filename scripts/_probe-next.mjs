import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('https://otop.pages.dev/?view=find', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4000);
const r = await p.evaluate(() => {
  const out = [];
  const walk = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && /next/i.test(n.textContent)) {
        const rect = n.parentElement?.getBoundingClientRect();
        out.push({ text: n.textContent.trim().slice(0,40), tag: n.parentElement?.tagName, cls: n.parentElement?.className, x: rect?.x, y: rect?.y });
      }
      if (n.nodeType === 1) walk(n);
    }
  };
  walk(document.body);
  return out;
});
console.log(JSON.stringify(r, null, 2));
await b.close();
