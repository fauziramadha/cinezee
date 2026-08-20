/**
 * src/components/badge/badge-label.tsx
 * Render badge icon + name label
 */

import { BadgeIcon } from "./badge-icon";

interface BadgeLabelProps {
  slug: string;
  name: string;
  size?: number;
}

export function BadgeLabel({ slug, name, size = 12 }: BadgeLabelProps) {
  return (
    <span className={`cs-badge-label cs-badge-label-${slug}`}>
      <BadgeIcon slug={slug} size={size} />
      {name}
    </span>
  );
}
