import Link from "next/link";

/** Internal paths use next/link; everything else is a plain anchor (optionally in a new tab). */
export default function SmartLink({ href, newTab, className, children, onClick, ...rest }: { href: string; newTab?: boolean; className?: string; children: React.ReactNode; onClick?: () => void; [k: string]: unknown }) {
  const internal = /^\/(?!\/)/.test(href);
  if (internal && !newTab) {
    return <Link href={href} className={className} onClick={onClick} {...rest}>{children}</Link>;
  }
  return (
    <a href={href} className={className} onClick={onClick} {...(newTab ? { target: "_blank", rel: "noopener" } : {})} {...rest}>
      {children}
    </a>
  );
}
