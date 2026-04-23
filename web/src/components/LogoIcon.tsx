export function LogoIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bolt-grad" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-gradient-start)" />
          <stop offset="100%" stopColor="var(--color-brand-gradient-end)" />
        </linearGradient>
      </defs>
      <path
        fill="url(#bolt-grad)"
        d="M296 470c-5 7-16 3-16-6V356c0-12-10-22-22-22H148c-7 0-12-9-7-15l62-87c9-12 0-30-16-30H56c-7 0-12-8-7-15L136 30c2-2 5-4 8-4h232c7 0 12 9 7 15l-62 87c-9 12 0 30 16 30h92c8 0 12 9 8 15L296 470z"
      />
    </svg>
  );
}
