type BrandMarkProps = Readonly<{
  className?: string;
}>;

export function BrandMark({ className = "size-6" }: BrandMarkProps) {
  return (
    <span
      className={`grid shrink-0 grid-cols-2 gap-px bg-foreground p-px ${className}`}
      aria-hidden="true"
    >
      <span className="bg-background" />
      <span className="bg-primary" />
      <span className="bg-primary" />
      <span className="bg-background" />
    </span>
  );
}
