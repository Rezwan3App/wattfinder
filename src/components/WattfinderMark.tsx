export function WattfinderMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#E2EFE4" />
      <path
        d="M6.2 22.2 10.6 9.4 16 20.2 20.8 9.6 22.6 15.4"
        stroke="#1C4A30"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="21.4" y="14.6" width="5.2" height="7" rx="1.3" fill="#1C4A30" />
      <rect x="26.2" y="15.8" width="2.4" height="1.6" rx="0.45" fill="#1C4A30" />
      <rect x="26.2" y="18.8" width="2.4" height="1.6" rx="0.45" fill="#1C4A30" />
    </svg>
  );
}
