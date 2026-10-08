import {
  Archive,
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleDot,
  OctagonAlert,
  Search,
} from "lucide-react";
import projectIcons from "./project-icons";

export const DEFAULT_COLUMN_ICON_NAMES = {
  "to-do": "Circle",
  "in-progress": "CircleDot",
  blocked: "OctagonAlert",
  "in-review": "Search",
  done: "CheckCircle2",
  archived: "Archive",
  planned: "CircleDashed",
} as const;

const columnIcons = {
  ...projectIcons,
  Circle,
  CircleDot,
  Search,
  CheckCircle2,
  CircleDashed,
  Archive,
  OctagonAlert,
};

export type ColumnIconName = keyof typeof columnIcons;

export default columnIcons;
