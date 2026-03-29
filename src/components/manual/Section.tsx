import React from 'react';

/** Simple wrapper component for manual sections */
export default function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-8">
      {children}
    </section>
  );
}
