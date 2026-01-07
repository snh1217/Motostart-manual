import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { buildUrl, fetchJson } from "@/lib/api";
import type { PartEntry } from "@/lib/types";

export default function PartDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const partId = typeof params.id === "string" ? params.id : "";
  const [item, setItem] = useState<PartEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!partId) return;
    const load = async () => {
      setLoading(true);
      try {
        const url = buildUrl("/api/parts", { id: partId });
        const data = await fetchJson<{ items: PartEntry[] }>(url);
        setItem(data.items?.[0] ?? null);
      } catch {
        setItem(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [partId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.helper}>부품 정보를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.meta}>{item.model} · {item.system}</Text>
      {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}

      {item.steps?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>작업 절차</Text>
          {item.steps
            .sort((a, b) => a.order - b.order)
            .map((step) => (
              <View key={step.order} style={styles.stepCard}>
                <Text style={styles.stepTitle}>{step.order}. {step.title}</Text>
                {step.desc ? <Text style={styles.stepText}>{step.desc}</Text> : null}
                {step.tools ? <Text style={styles.stepMeta}>도구: {step.tools}</Text> : null}
                {step.torque ? <Text style={styles.stepMeta}>토크: {step.torque}</Text> : null}
                {step.note ? <Text style={styles.stepMeta}>비고: {step.note}</Text> : null}
              </View>
            ))}
        </View>
      ) : null}

      {item.photos?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>참고 사진</Text>
          {item.photos.map((photo, idx) => (
            <View key={photo.id ?? `${photo.url}-${idx}`} style={styles.photoCard}>
              <Text style={styles.stepTitle}>{photo.label ?? "사진"}</Text>
              <Text style={styles.stepText}>{photo.url}</Text>
              {photo.desc ? <Text style={styles.stepMeta}>{photo.desc}</Text> : null}
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
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  helper: {
    fontSize: 13,
    color: "#94a3b8",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  meta: {
    fontSize: 12,
    color: "#64748b",
  },
  summary: {
    fontSize: 14,
    color: "#0f172a",
  },
  section: {
    marginTop: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  stepCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    backgroundColor: "#fff",
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  stepText: {
    marginTop: 4,
    fontSize: 13,
    color: "#475569",
  },
  stepMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  photoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    backgroundColor: "#fff",
  },
});
