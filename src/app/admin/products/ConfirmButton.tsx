"use client";

/** Submit button that asks for confirmation first (for destructive actions inside server-action forms). */
export default function ConfirmButton({ message, className = "", children, ...rest }: { message: string; className?: string; children: React.ReactNode; [k: string]: any }) {
  return (
    <button
      {...rest}
      className={className}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
