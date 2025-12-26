import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://motostart-manual.vercel.app";

type CaseRow = {
  id: string;
  model: string;
  system: string;
  symptom: string;
  action: string;
  photo_1?: string;
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("fetch failed");
  return (await response.json()) as T;
};

const SYSTEM_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "engine", label: "엔진" },
  { value: "chassis", label: "차대" },
  { value: "electrical", label: "전장" },
];

export default function CasesScreen() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [model, setModel] = useState("all");
  const [system, setSystem] = useState("all");

  useEffect(() => {
    fetchJson<CaseRow[]>(`${WEB_BASE_URL}/data/cases.json`)
      .then(setCases)
      .catch(() => setCases([]));
  }, []);

  const modelOptions = useMemo(() => {
    const unique = new Set(cases.map((item) => item.model));
    return ["all", ...Array.from(unique).sort()];
  }, [cases]);

  const filtered = cases.filter((item) => {
    if (model !== "all" && item.model !== model) return false;
    if (system !== "all" && item.system !== system) return false;
    return true;
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>필터</Text>
        <View style={styles.modelRow}>
          {modelOptions.map((item) => (
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
        <View style={styles.systemRow}>
          {SYSTEM_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setSystem(option.value)}
              style={[
                styles.systemTab,
                system === option.value && styles.systemTabActive,
              ]}
            >
              <Text
                style={[
                  styles.systemTabText,
                  system === option.value && styles.systemTabTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>정비사례</Text>
        {filtered.length ? (
          filtered.map((item) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{item.symptom}</Text>
              <Text style={styles.itemMeta}>{item.model} · {item.system}</Text>
              <Text style={styles.itemSub}>{item.action}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.helper}>표시할 사례가 없습니다.</Text>
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
  systemRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  systemTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  systemTabActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  systemTabText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  systemTabTextActive: {
    color: "#fff",
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
  helper: {
    fontSize: 13,
    color: "#94a3b8",
  },
});
