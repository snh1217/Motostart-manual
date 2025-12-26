export type ModelCode = "350D" | "368G" | "125M";

export type ManualType = "engine" | "chassis" | "user" | "wiring";

export type SpecRow = {
  id: string;
  model: ModelCode;
  category: string;
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
