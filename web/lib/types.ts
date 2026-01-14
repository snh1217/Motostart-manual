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
  pdf_ko_url?: string;
  pdf_original_url?: string;
  updated_at: string;
};

export type DiagnosticLine = {
  source: string;
  translation?: string;
  data: string;
  analysis?: string;
  note?: string;
};

export type DiagnosticEntry = {
  id: string;
  model: ModelCode;
  title: string;
  section?: string;
  image: string;
  images?: string[];
  video_cold_url?: string;
  video_hot_url?: string;
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

export type CaseEntry = {
  id: string;
  model: string;
  system?: string;
  category?: string;
  symptom?: string;
  symptomTitle?: string;
  title?: string;
  description?: string;
  fixSteps?: string;
  action?: string;
  cause?: string;
  parts?: string;
  tags?: string;
  references?: string;
  diagnosisTreeId?: string;
  diagnosisResultId?: string;
  photo_1?: string;
  photo_1_desc?: string;
  photo_2?: string;
  photo_2_desc?: string;
  photo_3?: string;
  photo_3_desc?: string;
  photo_4?: string;
  photo_4_desc?: string;
  photo_5?: string;
  photo_5_desc?: string;
  created_at?: string;
  updated_at?: string;
};

export type DiagnosisLinkType = "manual" | "torque" | "parts" | "case";

export type DiagnosisLink = {
  type: DiagnosisLinkType;
  label: string;
  urlOrRoute: string;
  meta?: Record<string, string>;
};

export type DiagnosisQuestionNode = {
  id: string;
  type: "question";
  text: string;
  yesNextId: string;
  noNextId: string;
};

export type DiagnosisStepNode = {
  id: string;
  type: "step";
  text: string;
  nextId: string;
};

export type DiagnosisResultNode = {
  id: string;
  type: "result";
  text: string;
  actions: string[];
  links?: DiagnosisLink[];
};

export type DiagnosisNode = DiagnosisQuestionNode | DiagnosisStepNode | DiagnosisResultNode;

export type DiagnosisTree = {
  treeId: string;
  title: string;
  category: string;
  symptomTitle?: string;
  supportedModels: string[];
  startNodeId: string;
  nodes: DiagnosisNode[];
};
