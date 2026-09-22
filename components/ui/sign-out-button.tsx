"use client";

import { signOut } from "next-auth/react";

import { t } from "@/lib/i18n";
interface Props {
  className?: string;
  children?: React.ReactNode;
}

export function SignOutButton({ className, children }: Props) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className}
    >
      {children ?? t("nav.cerrarSesion")}
    </button>
  );
}
