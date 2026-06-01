// ui/src/components/db/LakebaseTag.tsx
//
// "written to lakebase.TABLE" attribution caption — drop on every write
// surface so it's obvious what we persist.
import Icon from "./Icon";

type LakebaseTagProps = {
  table: string;
  tone?: "light" | "dark";
};

export default function LakebaseTag({ table, tone = "light" }: LakebaseTagProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10.5,
        fontFamily: "var(--font-mono)",
        color: tone === "dark" ? "var(--db-navy-400)" : "var(--db-gray-text)",
      }}
    >
      <Icon name="inventory" size={12} color="currentColor" /> written to lakebase.{table}
    </span>
  );
}
