export type Tag = {
  id: string;
  name: string;
  color?: string | null;
  kind: "user" | "system" | "auto";
  createdAt?: string | null;
};

export type TagKind = Tag["kind"];
