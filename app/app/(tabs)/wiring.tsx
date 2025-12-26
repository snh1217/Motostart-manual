import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://motostart-manual.vercel.app";

type WiringEntry = {
  id: string;
  model: string;
  title: string;
  tags?: string[];
  note?: string;
  file: string;
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("fetch failed");
  return (await response.json()) as T;
};

export default function WiringScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<WiringEntry[]>([]);
  const [model, setModel] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchJson<WiringEntry[]>(`${WEB_BASE_URL}/data/wiring_manifest.json`)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  const modelOptions = useMemo(() => {
    const unique = new Set(entries.map((item) => item.model));
    return ["all", ...Array.from(unique).sort()];
  }, [entries]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = entries.filter((item) => {
    if (model !== "all" && item.model !== model) return false;
    if (!normalizedQuery) return true;
    const haystack = [item.title, item.note, ...(item.tags ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>회로도 검색</Text>
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
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="예: 시동, 충전, ABS"
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>회로도 목록</Text>
        {filtered.length ? (
          filtered.map((item) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>{item.model}</Text>
              {item.note ? <Text style={styles.itemSub}>{item.note}</Text> : null}
              <Pressable
                style={styles.linkButton}
                onPress={() =>
                  router.push({
                    pathname: "/viewer",
                    params: {
                      url: `${WEB_BASE_URL}${item.file}`,
                      title: item.title,
                    },
                  })
                }
              >
                <Text style={styles.linkButtonText}>회로도 보기</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.helper}>표시할 회로도가 없습니다.</Text>
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
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
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
