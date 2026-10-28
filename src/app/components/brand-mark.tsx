import Image from "next/image";

type BrandMarkProps = {
  className?: string;
};

/** Shared verified monogram from the Money Watch brand asset. */
export function BrandMark({ className = "pw-brand-mark" }: BrandMarkProps) {
  return (
    <Image
      src="/brand/logo-mark.svg"
      alt=""
      aria-hidden="true"
      className={className}
      width={60}
      height={40}
      priority
    />
  );
}
