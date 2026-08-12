"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Handshake,
  House,
  Info,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  TriangleAlert,
  Users,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

/**
 * Ikonnavn i designsystemet er kebab-case (som i Lucide sin egen katalog).
 * Legg til nye ikoner her — da er de tilgjengelige overalt via <Icon name="..." />.
 */
const ICONS = {
  "alert-circle": CircleAlert,
  "alert-triangle": TriangleAlert,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "badge-check": BadgeCheck,
  building: Building2,
  check: Check,
  "check-circle": CircleCheck,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  clock: Clock,
  "external-link": ExternalLink,
  "file-text": FileText,
  globe: Globe,
  handshake: Handshake,
  home: House,
  info: Info,
  "log-in": LogIn,
  mail: Mail,
  "map-pin": MapPin,
  phone: Phone,
  plus: Plus,
  search: Search,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  sun: Sun,
  target: Target,
  "trending-up": TrendingUp,
  users: Users,
  wrench: Wrench,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
};

/** Ikonet arver farge fra `currentColor`, så det følger teksten rundt seg. */
export function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  style,
  className,
}: IconProps) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  return (
    <Glyph
      aria-hidden="true"
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={{ flex: "none", ...style }}
    />
  );
}

export default Icon;
