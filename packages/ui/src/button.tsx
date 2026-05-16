import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function Button({ children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        border: "1px solid #1f2937",
        borderRadius: 6,
        padding: "0.625rem 0.875rem",
        background: "#111827",
        color: "#ffffff",
        fontWeight: 600,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}
