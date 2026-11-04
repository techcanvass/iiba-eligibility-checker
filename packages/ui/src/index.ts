import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { CertificationFinder, type CertificationFinderProps } from "./CertificationFinder";

export { CertificationFinder } from "./CertificationFinder";
export type { CertificationFinderProps } from "./CertificationFinder";

/** Mount the finder into any element — used by WordPress and plain HTML pages. */
export function mount(el: Element, props: CertificationFinderProps = {}): Root {
  const root = createRoot(el);
  root.render(createElement(CertificationFinder, props));
  return root;
}
