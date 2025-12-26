import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://motostart-manual.vercel.app";

type ManualEntry = {
  id: string;
  model: string;
  manual_type: string;
  section: string;
  title: string;
  pages: { start: number; end: number };
  file: string;
};

type CaseRow = {
  id: string;
  model: string;
  system: string;
  symptom: string;
  action: string;
};

type VideoRow = {
  id: string;
  model: string;
  system: string;
  title: string;
  link: string;
  tags?: string;
};

type TranslationItem = {
  entryId: string;
  title_ko?: string;
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("fetch failed");
  return (await response.json()) as T;
};

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; model?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const initialModel = typeof params.model === "string" ? params.model : "all";

  const [query, setQuery] = useState(initialQuery);
  const [model, setModel] = useState(initialModel);
  const [manuals, setManuals] = useState<ManualEntry[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [translations, setTranslations] = useState<TranslationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const translationMap = useMemo(() => {
    const map = new Map<string, string>();
    translations.forEach((item) => {
      if (item.entryId && item.title_ko) {
        map.set(item.entryId, item.title_ko);
      }
    });
    return map;
  }, [translations]);

  const handleSearch = () => {
    router.setParams({ q: query.trim(), model });
  };

  useEffect(() => {
    const load = async () => {
      if (!query.trim()) return;
      setLoading(true);
      try {
        const [manualData, caseData, videoData, translationData] =
          await Promise.all([
            fetchJson<{ entries: ManualEntry[] }>(
              `${WEB_BASE_URL}/manuals/manifest.json`
            ).then((data) => data.entries ?? []),
            fetchJson<CaseRow[]>(`${WEB_BASE_URL}/data/cases.json`).catch(() => []),
            fetchJson<VideoRow[]>(`${WEB_BASE_URL}/data/videos.json`).catch(() => []),
            fetchJson<TranslationItem[]>(
              `${WEB_BASE_URL}/data/translations.json`
            ).catch(() => []),
          ]);

        setManuals(manualData);
        setCases(caseData);
        setVideos(videoData);
        setTranslations(translationData);
      } catch {
        setManuals([]);
        setCases([]);
        setVideos([]);
        setTranslations([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [query]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredManuals = manuals.filter((item) => {
    if (model !== "all" && item.model !== model) return false;
    if (!normalizedQuery) return false;
    const haystack = `${item.title} ${item.section}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const filteredCases = cases.filter((item) => {
    if (model !== "all" && item.model !== model) return false;
    if (!normalizedQuery) return false;
    const haystack = `${item.symptom} ${item.action}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const filteredVideos = videos.filter((item) => {
    if (model !== "all" && item.model !== model) return false;
    if (!normalizedQuery) return false;
    const haystack = `${item.title} ${item.tags ?? ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>검색</Text>
        <View style={styles.modelRow}>
          {["all", "350D", "368G", "125M"].map((item) => (
            <Pressable
              key={item}
              onPress={() => setModel(item)}
              style={[styles.modelChip, model === item && styles.modelChipActive]}
            >
              <Text style={[styles.modelChipText, model === item && styles.modelChipTextActive]}>
                {item === "all" ? "전체" : item}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="예: 드레인볼트 토크, 헤드 토크"
          style={styles.input}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Pressable style={styles.primaryButton} onPress={handleSearch}>
          <Text style={styles.primaryButtonText}>검색</Text>
        </Pressable>
      </View>

      {loading ? <Text style={styles.helper}>불러오는 중...</Text> : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>매뉴얼</Text>
        {filteredManuals.length ? (
          filteredManuals.slice(0, 8).map((item) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {translationMap.get(item.id) ? (
                <Text style={styles.itemSub}>{translationMap.get(item.id)}</Text>
              ) : null}
              <Text style={styles.itemMeta}>{item.model} · {item.section}</Text>
              <Pressable
                style={styles.linkButton}
                onPress={() =>
                  router.push({
                    pathname: "/viewer",
                    params: {
                      entryId: item.id,
                      file: item.file,
                      page: String(item.pages.start),
                      title: item.title,
                    },
                  })
                }
              >
                <Text style={styles.linkButtonText}>매뉴얼 보기</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.helper}>검색 결과가 없습니다.</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>정비사례</Text>
        {filteredCases.length ? (
          filteredCases.slice(0, 8).map((item) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{item.symptom}</Text>
              <Text style={styles.itemMeta}>{item.model} · {item.system}</Text>
              <Text style={styles.itemSub}>{item.action}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.helper}>검색 결과가 없습니다.</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>영상</Text>
        {filteredVideos.length ? (
          filteredVideos.slice(0, 8).map((item) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>{item.model} · {item.system}</Text>
              <Pressable
                style={styles.linkButton}
                onPress={() => Linking.openURL(item.link)}
              >
                <Text style={styles.linkButtonText}>영상 열기</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.helper}>검색 결과가 없습니다.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  modelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  modelChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    backgroundColor: "#f8fafc",
  },
  modelChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  modelChipText: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "600",
  },
  modelChipTextActive: {
    color: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  listItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  itemMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  itemSub: {
    fontSize: 13,
    color: "#475569",
    marginTop: 4,
  },
  linkButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  helper: {
    fontSize: 13,
    color: "#94a3b8",
  },
});
