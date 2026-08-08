import React from "react";
import logoUrl from "../assets/images/serenapsi_logo_v3.jpg.png";

interface LogoProps {
  className?: string;
  size?: number;
}

export function LogoIcon({ className = "", size = 48 }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="SerenaPsi Icon"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`object-cover rounded-xl shadow-sm ${className}`}
      referrerPolicy="no-referrer"
    />
  );
}

export function FullLogo({ className = "", showTagline = true }: { className?: string; showTagline?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <img
        src={logoUrl}
        alt="SerenaPsi Logo"
        className="w-56 h-56 rounded-[32px] shadow-xl border border-emerald-100/20 object-contain hover:scale-102 transition duration-300"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
