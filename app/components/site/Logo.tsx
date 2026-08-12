import Image from "next/image";
import Link from "next/link";

const WORDMARK = { width: 1042, height: 182 };
const MARK = { width: 177, height: 145 };

export type LogoProps = {
  /** "dark" på lys bakgrunn, "white" på mørk bakgrunn, "mark" = kun symbolet. */
  variant?: "dark" | "white" | "mark";
  height?: number;
  /** Pakk logoen i en lenke til forsiden. */
  href?: string;
  priority?: boolean;
};

export function Logo({
  variant = "dark",
  height = 28,
  href,
  priority,
}: LogoProps) {
  const isMark = variant === "mark";
  const src = isMark
    ? "/soleklart-mark.png"
    : variant === "white"
      ? "/soleklart-wordmark-white.png"
      : "/soleklart-wordmark-dark.png";
  const base = isMark ? MARK : WORDMARK;
  const width = Math.round((base.width / base.height) * height);

  const img = (
    <Image
      src={src}
      alt="Soleklart"
      width={width}
      height={height}
      priority={priority}
      style={{ height, width: "auto" }}
    />
  );

  if (href) {
    return (
      <Link href={href} aria-label="Soleklart – til forsiden" style={{ display: "block" }}>
        {img}
      </Link>
    );
  }
  return img;
}

export default Logo;
