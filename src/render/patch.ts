/**
 * Patch an element's content to new HTML in place (Mathias, 2026-09-25).
 *
 * The village ticks every second and the panel, the header and the dev bar
 * were rewritten with innerHTML each time something in them moved. Rewriting
 * replaces every node: the element under the pointer (and its tooltip), the
 * button half-way through a click, and the section being scrolled, which comes
 * back at its top. A tick must never do that to what the player is using.
 *
 * `patchHtml` walks the old and the new trees side by side and changes only
 * what differs: a text node's text, an attribute, or — where the shape itself
 * changed — that one node. Everything that did not change stays the same
 * node, so hover, focus, scroll position, an open <details> and a <select>'s
 * chosen value all survive. Event handling is delegated from the container,
 * so nothing is lost with a node either.
 */
export function patchHtml(target: Element, html: string): void {
  const tpl = target.ownerDocument.createElement('template');
  tpl.innerHTML = html;
  patchChildren(target, tpl.content);
}

/** The attributes that say a node is a different thing, not the same thing changed. */
const IDENTITY = ['id', 'data-slot', 'data-tab', 'data-report', 'data-menu', 'data-intrigue', 'data-select-slot', 'data-build', 'data-building'];

function sameThing(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== Node.ELEMENT_NODE) return true;
  const ea = a as Element;
  const eb = b as Element;
  if (ea.tagName !== eb.tagName) return false;
  return IDENTITY.every((k) => ea.getAttribute(k) === eb.getAttribute(k));
}

function patchChildren(from: Node, to: Node): void {
  const want = Array.from(to.childNodes);
  let have = Array.from(from.childNodes);
  for (let i = 0; i < want.length; i++) {
    const nb = want[i];
    const na = have[i];
    if (!na) {
      from.appendChild(nb);
      continue;
    }
    if (!sameThing(na, nb)) {
      from.replaceChild(nb, na);
      continue;
    }
    if (na.nodeType === Node.ELEMENT_NODE) {
      patchAttributes(na as Element, nb as Element);
      patchChildren(na, nb);
    } else if (na.nodeValue !== nb.nodeValue) {
      na.nodeValue = nb.nodeValue;
    }
  }
  have = Array.from(from.childNodes);
  for (let i = have.length - 1; i >= want.length; i--) from.removeChild(have[i]);
}

function patchAttributes(a: Element, b: Element): void {
  for (const { name } of Array.from(a.attributes)) {
    if (!b.hasAttribute(name)) a.removeAttribute(name);
  }
  for (const { name, value } of Array.from(b.attributes)) {
    if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  }
  // A property the player can change and markup cannot see: keep what they chose
  // unless the markup itself now disables or removes the choice.
  if (a instanceof HTMLButtonElement || a instanceof HTMLInputElement || a instanceof HTMLSelectElement) {
    (a as HTMLButtonElement).disabled = b.hasAttribute('disabled');
  }
}
