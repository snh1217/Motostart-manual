import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

const MODEL_OPTIONS = ["all", "350D", "368G", "125M"] as const;

export default function HomeScreen() {
  const router = useRouter();
  const [model, setModel] = useState<(typeof MODEL_OPTIONS)[number]>("all");
  const [query, setQuery] = useState("");

  const placeholder = useMemo(
    () => "예: 드레인볼트 토크, 헤드 토크",
    []
  );

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push({
      pathname: "/search",
      params: { q: trimmed, model },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>MOTOSTAR Manual Hub</Text>
      <Text style={styles.subtitle}>모델을 선택하고 바로 검색하세요.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>모델 선택</Text>
        <View style={styles.modelRow}>
          {MODEL_OPTIONS.map((item) => (
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
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>검색</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Pressable style={styles.primaryButton} onPress={handleSearch}>
          <Text style={styles.primaryButtonText}>검색</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
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
    fontWeight: "600",
    marginBottom: 12,
  },
  modelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
});
