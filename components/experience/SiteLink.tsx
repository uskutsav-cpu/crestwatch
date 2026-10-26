import type { ComponentProps } from "react";

/** Use document navigation for route links on the hosted Worker runtime.
 * This keeps navigation independent of the runtime's RSC transition transport.
 * Hash links retain normal browser scrolling and history behavior.
 */
export function SiteLink(props: ComponentProps<"a">) {
  return <a {...props} />;
}
