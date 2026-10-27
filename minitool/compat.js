/* The few runtime pieces the reader uses that Chrome 61 (the mini tool's oldest WebView) doesn't have. Syntax is
   lowered by esbuild; these are the APIs it can't lower. */
if (!Array.prototype.flatMap) {
  Object.defineProperty(Array.prototype, 'flatMap', {configurable: true, writable: true, value(f, self) {
    const out = [];
    for (let i = 0; i < this.length; i++) { const v = f.call(self, this[i], i, this); if (Array.isArray(v)) out.push(...v); else out.push(v); }
    return out;
  }});
}
