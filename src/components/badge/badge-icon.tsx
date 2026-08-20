/**
 * src/components/badge/badge-icon.tsx
 * Render badge icon (pure CSS, no images)
 */

interface BadgeIconProps {
  slug: string;
  size?: number;
}

export function BadgeIcon({ slug, size = 14 }: BadgeIconProps) {
  const className = `cs-badge cs-badge-${slug}`;
  return (
    <span
      className={className}
      style={{ width: size, height: size }}
      aria-label={slug}
    />
  );
}
