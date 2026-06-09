import {
  INPUT_TYPE_COLORS,
  INPUT_TYPE_LABELS,
  type InputType,
} from "@/lib/detect";

interface TypeBadgeProps {
  type: InputType;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${INPUT_TYPE_COLORS[type]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {INPUT_TYPE_LABELS[type]}
    </span>
  );
}
