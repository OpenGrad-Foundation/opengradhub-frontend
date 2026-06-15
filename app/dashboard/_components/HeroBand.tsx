"use client";

import React from 'react';

type HeroBandProps = {
  userName: string;
  roleName: string;
};

export default function HeroBand({ userName, roleName }: HeroBandProps) {
  return (
    <section className="mb-6 overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#034852] via-[#006d6c] to-[#209379] p-6 text-white shadow-xl shadow-teal-950/10 md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-teal-100/80">
            {roleName}
          </p>
          <h1
            className="text-3xl font-bold tracking-tight md:text-4xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Welcome back, {userName} 👋
          </h1>
        </div>
        <div className="shrink-0 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white/90 ring-1 ring-white/20">
          {roleName}
        </div>
      </div>
    </section>
  );
}
