import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dataPath = (file: string) => path.resolve(process.cwd(), "data", file);

const loadManifestEntryIds = async (): Promise<string[]> => {
  try {
    const manifestPath = path.resolve(
      process.cwd(),
      "public",
      "manuals",
      "manifest.json"
    );
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as { entries?: Array<{ id: string }> };
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    return entries.slice(0, 3).map((entry) => entry.id);
  } catch {
    return ["sample-entry-1", "sample-entry-2", "sample-entry-3"];
  }
};

const seedCases = () => [
  {
    id: "case-350d-01",
    model: "350D",
    system: "engine",
    symptom: "드레인볼트 토크값 문의",
    action: "23 N·m로 체결 후 누유 확인",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-350d-02",
    model: "350D",
    system: "chassis",
    symptom: "브레이크 레버 간격 과다",
    action: "레버 간격 조정 및 점검",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-350d-03",
    model: "350D",
    system: "electrical",
    symptom: "점화 스위치 반응 없음",
    action: "메인 릴레이 퓨즈 점검",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-368g-01",
    model: "368G",
    system: "engine",
    symptom: "엔진오일량 확인 요청",
    action: "1.6L 기준으로 보충",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-368g-02",
    model: "368G",
    system: "chassis",
    symptom: "서스펜션 소음",
    action: "마운트 고정 토크 확인",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-368g-03",
    model: "368G",
    system: "electrical",
    symptom: "계기판 경고등 점등",
    action: "배선 커넥터 접촉 확인",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-125m-01",
    model: "125M",
    system: "engine",
    symptom: "실린더 헤드 커버 누유",
    action: "가스켓 상태 확인 후 교체",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-125m-02",
    model: "125M",
    system: "chassis",
    symptom: "핸들 진동 발생",
    action: "휠 밸런스 점검",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-125m-03",
    model: "125M",
    system: "electrical",
    symptom: "시동 경고등 점등",
    action: "센서 커넥터 점검",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-mix-01",
    model: "368G",
    system: "engine",
    symptom: "냉각수 온도 경고",
    action: "온도 센서 확인",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-mix-02",
    model: "350D",
    system: "electrical",
    symptom: "라이트 점멸",
    action: "배선 접촉 상태 점검",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
  {
    id: "case-mix-03",
    model: "125M",
    system: "chassis",
    symptom: "브레이크 패드 마모",
    action: "패드 교체 및 테스트",
    photo_1: "",
    photo_2: "",
    photo_3: "",
  },
];

const seedVideos = () => [
  {
    id: "video-350d-01",
    model: "350D",
    system: "engine",
    title: "350D 엔진오일 교환",
    link: "https://example.com/350d-oil",
    tags: "오일,엔진",
  },
  {
    id: "video-350d-02",
    model: "350D",
    system: "chassis",
    title: "350D 브레이크 점검",
    link: "https://example.com/350d-brake",
    tags: "브레이크,차대",
  },
  {
    id: "video-368g-01",
    model: "368G",
    system: "engine",
    title: "368G CVT 점검",
    link: "https://example.com/368g-cvt",
    tags: "cvt,엔진",
  },
  {
    id: "video-368g-02",
    model: "368G",
    system: "electrical",
    title: "368G 배선 점검",
    link: "https://example.com/368g-wire",
    tags: "전장,배선",
  },
  {
    id: "video-125m-01",
    model: "125M",
    system: "engine",
    title: "125M 엔진오일 교환",
    link: "https://example.com/125m-oil",
    tags: "오일,엔진",
  },
  {
    id: "video-125m-02",
    model: "125M",
    system: "chassis",
    title: "125M 브레이크 점검",
    link: "https://example.com/125m-brake",
    tags: "브레이크,차대",
  },
];

const seedWiring = () => [
  {
    id: "368g-start",
    model: "368G",
    title: "Starting / Ignition",
    tags: ["시동", "스타터", "점화", "ignition", "starter"],
    note: "시동 릴레이, 스타터모터, 점화스위치 경로 포함",
    file: "/wiring/368G/starting.pdf",
  },
  {
    id: "350d-charging",
    model: "350D",
    title: "Charging / Battery",
    tags: ["충전", "배터리", "레귤레이터", "charging", "battery"],
    note: "발전기, 레귤레이터, 배터리 라인 점검",
    file: "/wiring/350D/charging.pdf",
  },
  {
    id: "125m-lighting",
    model: "125M",
    title: "Lighting / Signals",
    tags: ["조명", "신호", "방향지시", "lighting", "signal"],
    note: "헤드라이트, 시그널, 방향지시등 회로",
    file: "/wiring/125M/lighting.pdf",
  },
];

export async function POST() {
  if (process.env.READ_ONLY_MODE === "1") {
    return NextResponse.json(
      { error: "읽기 전용 모드에서는 샘플 생성이 불가합니다." },
      { status: 403 }
    );
  }

  const entryIds = await loadManifestEntryIds();
  const translations = [
    {
      entryId: entryIds[0] ?? "sample-entry-1",
      title_ko: "좌측 크랭크케이스 커버 및 CVT",
      summary_ko: "CVT 커버 탈거/조립 절차 요약.",
      text_ko: "1) 시동을 끄고 차량을 고정한다.\n2) 지정된 순서로 볼트를 분리한다.",
      updated_at: "2025-12-26",
    },
    {
      entryId: entryIds[1] ?? "sample-entry-2",
      title_ko: "실린더 헤드 커버",
      summary_ko: "분해/조립 절차 요약.",
      text_ko: "1) 냉각수를 배출한다.\n2) 커버를 분리한다.",
      updated_at: "2025-12-26",
    },
    {
      entryId: entryIds[2] ?? "sample-entry-3",
      title_ko: "기어박스",
      summary_ko: "기어박스 점검 및 정비.",
      text_ko: "1) 드레인 볼트를 제거한다.\n2) 마모 상태를 확인한다.",
      updated_at: "2025-12-26",
    },
    {
      entryId: "sample-entry-4",
      title_ko: "윤활 시스템",
      summary_ko: "오일 펌프/필터 점검.",
      text_ko: "1) 오일 필터를 분리한다.\n2) 오일 펌프를 점검한다.",
      updated_at: "2025-12-26",
    },
    {
      entryId: "sample-entry-5",
      title_ko: "브레이크 시스템",
      summary_ko: "브레이크 라인 점검.",
      text_ko: "1) 패드 마모를 확인한다.\n2) 브레이크액을 보충한다.",
      updated_at: "2025-12-26",
    },
  ];

  const files = [
    "cases.json",
    "translations.json",
    "videos.json",
    "wiring_manifest.json",
  ];

  const cases = seedCases();
  const videos = seedVideos();
  const wiring = seedWiring();

  await fs.mkdir(path.resolve(process.cwd(), "data"), { recursive: true });
  await fs.writeFile(dataPath("cases.json"), JSON.stringify(cases, null, 2), "utf8");
  await fs.writeFile(
    dataPath("translations.json"),
    JSON.stringify(translations, null, 2),
    "utf8"
  );
  await fs.writeFile(dataPath("videos.json"), JSON.stringify(videos, null, 2), "utf8");
  await fs.writeFile(
    dataPath("wiring_manifest.json"),
    JSON.stringify(wiring, null, 2),
    "utf8"
  );

  return NextResponse.json({
    ok: true,
    files,
    counts: {
      cases: cases.length,
      translations: translations.length,
      videos: videos.length,
      wiring: wiring.length,
    },
  });
}
