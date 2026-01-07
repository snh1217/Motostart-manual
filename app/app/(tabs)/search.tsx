import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { buildUrl, fetchJson } from "@/lib/api";
import type { ModelEntry, SearchResult, SpecRow, SearchManualHit } from "@/lib/types";

const DEFAULT_MODELS = ["all", "350D", "368G", "125M"];

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("all");
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ models: ModelEntry[] }>(buildUrl("/api/models"))
      .then((data) => setModels(data.models ?? []))
      .catch(() => setModels([]));
  }, []);

  const modelOptions = useMemo(() => {
    const ids = models.map((item) => item.id).filter(Boolean);
    const unique = Array.from(new Set(ids));
    const sorted = unique.length ? unique : DEFAULT_MODELS.filter((m) => m !== "all");
    return ["all", ...sorted];
  }, [models]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl("/api/search", { q: trimmed, model });
      const data = await fetchJson<SearchResult>(url);
      setResult(data);
    } catch {
      setError("검색 결과를 불러오지 못했습니다.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const openManual = (hit: SearchManualHit) => {
    router.push({
      pathname: "/viewer",
      params: {
        entryId: hit.entryId,
        file: hit.file,
        page: String(hit.page ?? 1),
        title: hit.title,
      },
    });
  };

  const renderSpec = (spec: SpecRow) => (
    <View key={spec.id} style={styles.resultCard}>
      <Text style={styles.resultTitle}>{spec.item}</Text>
      <Text style={styles.resultMeta}>{spec.model} · {spec.category}</Text>
      <Text style={styles.resultValue}>{spec.value}</Text>
      {spec.note ? <Text style={styles.resultNote}>{spec.note}</Text> : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>검색</Text>
      <Text style={styles.subtitle}>모델과 키워드를 선택하세요.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>모델 선택</Text>
        <View style={styles.chipRow}>
          {modelOptions.map((item) => (
            <Pressable
              key={item}
              onPress={() => setModel(item)}
              style={[styles.chip, model === item && styles.chipActive]}
            >
              <Text style={[styles.chipText, model === item && styles.chipTextActive]}>
                {item === "all" ? "전체" : item}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sectionTitle}>검색어 입력</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="예: 엔진오일 용량, 헤드 토크"
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Pressable style={styles.primaryButton} onPress={handleSearch}>
          <Text style={styles.primaryButtonText}>검색</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : null}

      {error ? <Text style={styles.helper}>{error}</Text> : null}

      {result?.answerSpec ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>정답(스펙)</Text>
          {renderSpec(result.answerSpec)}
        </View>
      ) : null}

      {result?.otherSpecs?.length ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>추가 스펙</Text>
          {result.otherSpecs.map(renderSpec)}
        </View>
      ) : null}

      {result?.answerManual ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>매뉴얼 추천</Text>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{result.answerManual.title}</Text>
            {result.answerManual.title_ko ? (
              <Text style={styles.resultNote}>{result.answerManual.title_ko}</Text>
            ) : null}
            <Text style={styles.resultMeta}>
              {result.answerManual.model} · {result.answerManual.manual_type}
            </Text>
            <Text style={styles.resultNote}>{result.answerManual.snippet}</Text>
            <Pressable
              style={styles.linkButton}
              onPress={() => openManual(result.answerManual)}
            >
              <Text style={styles.linkButtonText}>매뉴얼 보기</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {result?.otherManuals?.length ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>추가 매뉴얼</Text>
          {result.otherManuals.map((hit) => (
            <View key={hit.id} style={styles.resultCard}>
              <Text style={styles.resultTitle}>{hit.title}</Text>
              <Text style={styles.resultMeta}>
                {hit.model} · {hit.manual_type}
              </Text>
              <Text style={styles.resultNote}>{hit.summary}</Text>
              <Pressable style={styles.linkButton} onPress={() => openManual(hit)}>
                <Text style={styles.linkButtonText}>매뉴얼 보기</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
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
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    backgroundColor: "#f8fafc",
  },
  chipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  chipText: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "600",
  },
  chipTextActive: {
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
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  helper: {
    fontSize: 13,
    color: "#ef4444",
  },
  resultCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    marginTop: 8,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  resultMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  resultValue: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  resultNote: {
    marginTop: 4,
    fontSize: 12,
    color: "#475569",
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
});
