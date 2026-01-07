export type ModelEntry = { id: string; name?: string };

export type SpecRow = {
  id: string;
  model: string;
  category: string;
  item: string;
  value: string;
  note?: string;
};

export type CaseRow = {
  id?: string;
  model: string;
  system: string;
  symptom: string;
  action: string;
  cause?: string;
  parts?: string;
  tags?: string;
  ref_manual_file?: string;
  ref_manual_page?: number;
  ref_youtube?: string;
  updated_at?: string;
};

export type WiringEntry = {
  id: string;
  model: string;
  title: string;
  tags?: string[];
  note?: string;
  file: string;
};

export type ManualEntry = {
  id: string;
  model: string;
  manual_type: string;
  section: string;
  title: string;
  title_ko?: string;
  file: string;
  pages: { start: number; end: number };
  language?: string;
  doc_date?: string;
  ko_file?: string;
};

export type PartPhoto = {
  id?: string;
  url: string;
  label?: string;
  desc?: string;
  tags?: string[];
};

export type PartVideo = {
  id?: string;
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
  model: string;
  system: string;
  name: string;
  summary?: string;
  tags?: string[];
  photos?: PartPhoto[];
  videos?: PartVideo[];
  steps?: PartStep[];
  updated_at?: string;
};

export type SearchManualHit = {
  id: string;
  entryId: string;
  model: string;
  manual_type: string;
  title: string;
  title_ko?: string;
  file: string;
  page: number;
  snippet: string;
  summary: string;
  score: number;
};

export type SearchResult = {
  answerSpec?: SpecRow | null;
  otherSpecs?: SpecRow[];
  answerManual?: SearchManualHit | null;
  otherManuals?: SearchManualHit[];
  fallbackMode?: string;
};
