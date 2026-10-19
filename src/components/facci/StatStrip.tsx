export function StatStrip({
  items,
}: {
  items: {
    label: string;
    value: string | number;
    tone?: "default" | "accent" | "warn" | "success" | "info" | "danger";
  }[];
}) {
  return (
    <div className="stat-strip fade-in">
      {items.map((item) => (
        <div key={item.label} className={`stat-tile tone-${item.tone ?? "default"}`}>
          <div className="stat-label">{item.label}</div>
          <div className="stat-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
