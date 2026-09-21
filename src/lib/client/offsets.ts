"use client";

/** Character offset of a point inside a paragraph element, marks included. */
export function offsetWithin(root: Node, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return total;
}

export type SelectedRange = { paragraph: number; start: number; end: number };

/** Reads the current selection back as paragraph plus character range. */
export function readSelection(container: HTMLElement): SelectedRange | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);

  const paragraphEl = (
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement
  )?.closest<HTMLElement>("[data-paragraph]");
  if (!paragraphEl || !container.contains(paragraphEl)) return null;
  if (!paragraphEl.contains(range.endContainer)) return null;

  const start = offsetWithin(paragraphEl, range.startContainer, range.startOffset);
  const end = offsetWithin(paragraphEl, range.endContainer, range.endOffset);
  if (end - start < 2) return null;

  return {
    paragraph: Number(paragraphEl.dataset.paragraph),
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}
