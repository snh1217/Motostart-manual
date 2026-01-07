export type ModelCode =
  | "125C"
  | "125D"
  | "125E"
  | "125M"
  | "310M"
  | "350D"
  | "350GK"
  | "368E"
  | "368G";

export type ManualType = "engine" | "chassis" | "user" | "wiring";

export type SpecRow = {
  id: string;
  model: ModelCode;
  category: "torque" | "oil" | "clearance" | "consumable";
  item: string;
  value: string;
  note?: string;
};

export type ManifestEntry = {
  id: string;
  model: ModelCode;
  manual_type: ManualType;
  section: string;
  title: string;
  title_ko?: string;
  language: string;
  doc_code?: string;
  doc_date?: string;
  pages: {
    start: number;
    end: number;
    total_in_original?: number;
  };
  source_pdf?: string;
  file: string;
  ko_file?: string;
};

export type TranslationItem = {
  entryId: string;
  title_ko?: string;
  summary_ko?: string;
  text_ko?: string;
  updated_at: string;
};

export type DiagnosticLine = {
  label: string;
  value: string;
  note?: string;
};

export type DiagnosticEntry = {
  id: string;
  model: ModelCode;
  title: string;
  section?: string;
  image: string;
  lines: DiagnosticLine[];
  note?: string;
  updated_at?: string;
  source?: "db" | "json";
};

export type PartPhoto = {
  id: string;
  url: string;
  label?: string;
  desc?: string;
  tags?: string[];
};

export type PartVideo = {
  id: string;
  url: string;
  label?: string;
  desc?: string;
  tags?: string[];
};

export type PartStep = {
  order: number;
  title: string;
  desc?: string;
  tools?: string;
  torque?: string;
  note?: string;
  photoIds?: string[];
};

export type PartEntry = {
  id: string;
  model: ModelCode | string;
  system: "engine" | "chassis" | "electrical" | "other";
  name: string;
  summary?: string;
  tags?: string[];
  photos?: PartPhoto[];
  videos?: PartVideo[];
  steps?: PartStep[];
  updated_at?: string;
  source?: "db" | "json";
};
