import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { buildUrl, fetchJson } from "@/lib/api";
import type { ManualEntry, ModelEntry } from "@/lib/types";

const MANUAL_TYPES = [
  { id: "all", label: "전체" },
  { id: "engine", label: "엔진" },
  { id: "chassis", label: "차대" },
  { id: "wiring", label: "회로도" },
  { id: "user", label: "사용자" },
];

export default function ManualsScreen() {
  const router = useRouter();
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [model, setModel] = useState("all");
  const [manualType, setManualType] = useState("all");
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJson<{ models: ModelEntry[] }>(buildUrl("/api/models"))
      .then((data) => setModels(data.models ?? []))
      .catch(() => setModels([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchJson<{ entries: ManualEntry[] }>(buildUrl("/manuals/manifest.json"))
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const modelOptions = useMemo(() => {
    const ids = models.map((item) => item.id).filter(Boolean);
    const unique = Array.from(new Set(ids));
    return ["all", ...unique];
  }, [models]);

  const filtered = entries.filter((entry) => {
    if (model !== "all" && entry.model !== model) return false;
    if (manualType !== "all" && entry.manual_type !== manualType) return false;
    return true;
  });

  const openViewer = (entry: ManualEntry) => {
    router.push({
      pathname: "/viewer",
      params: {
        entryId: entry.id,
        file: entry.file,
        page: String(entry.pages?.start ?? 1),
        title: entry.title,
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>매뉴얼</Text>
      <Text style={styles.subtitle}>모델별 매뉴얼 목록을 확인하세요.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>모델</Text>
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

        <Text style={styles.sectionTitle}>구분</Text>
        <View style={styles.chipRow}>
          {MANUAL_TYPES.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setManualType(item.id)}
              style={[styles.chip, manualType === item.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, manualType === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>매뉴얼 목록</Text>
        {filtered.length ? (
          filtered.map((entry) => (
            <View key={entry.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{entry.title}</Text>
              {entry.title_ko ? (
                <Text style={styles.itemNote}>{entry.title_ko}</Text>
              ) : null}
              <Text style={styles.itemMeta}>
                {entry.model} · {entry.manual_type} · {entry.section}
              </Text>
              <Text style={styles.itemNote}>페이지 {entry.pages?.start} - {entry.pages?.end}</Text>
              <Pressable style={styles.linkButton} onPress={() => openViewer(entry)}>
                <Text style={styles.linkButtonText}>매뉴얼 보기</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.helper}>표시할 매뉴얼이 없습니다.</Text>
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
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  helper: {
    fontSize: 13,
    color: "#94a3b8",
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
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  itemNote: {
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
