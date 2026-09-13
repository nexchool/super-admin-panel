import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Where a school stands against one of its seat limits. */
export function seatState(used: number, limit: number | null): "unlimited" | "within" | "full" | "over" {
  if (limit == null) return "unlimited";
  if (used > limit) return "over";
  if (used === limit) return "full";
  return "within";
}

type SeatCountProps = {
  used: number;
  limit: number | null;
  /** Long form ("263 of 150 active students · Over limit") for the detail card. */
  noun?: string;
  className?: string;
};

/**
 * "used / limit" for a seat limit, coloured by how close the school is.
 *
 * A school over its limit is an existing customer who outgrew their plan
 * (limits can be set below current use), not an error, so it reads as a
 * warning to act on: their next admission will be refused until the seats
 * are raised.
 */
export function SeatCount({ used, limit, noun, className }: SeatCountProps) {
  const state = seatState(used, limit);
  const tone =
    state === "over" ? "text-destructive font-semibold" : state === "full" ? "text-amber-600 font-medium" : "";
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", className)}>
      <span className={tone}>
        {used}
        {limit != null ? (noun ? ` of ${limit} ${noun}` : ` / ${limit}`) : noun ? ` ${noun}` : ""}
      </span>
      {state === "over" && <Badge variant="destructive">Over limit</Badge>}
      {state === "full" && <Badge variant="secondary">Full</Badge>}
      {state === "unlimited" && noun && (
        <span className="text-xs text-muted-foreground">no limit</span>
      )}
    </span>
  );
}
