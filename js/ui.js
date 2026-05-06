/** Tiny DOM helpers — keeps view code free of repetitive boilerplate. */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function flash(host, kind, text) {
  const div = el("div", { class: `message ${kind}` }, text);
  host.prepend(div);
  setTimeout(() => div.remove(), 4500);
}

/** Pretty-print a DRF error payload. */
export function errorText(err) {
  if (!err) return "Unknown error";
  if (err.payload && typeof err.payload === "object") {
    return Object.entries(err.payload)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n");
  }
  return err.message || String(err);
}