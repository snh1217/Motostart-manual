import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { buildUrl, fetchJson } from "@/lib/api";

type ModelEntry = {
  id: string;
  name?: string;
  parts_engine_url?: string;
  parts_chassis_url?: string;
};

type PartsItem = {
  id: string;
  name?: string;
  engineUrl?: string;
  chassisUrl?: string;
};

export default function PartsListLauncherMobile() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PartsItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    fetchJson<{ models: ModelEntry[] }>(buildUrl("/api/models"))
      .then((data) => {
        if (!active) return;
        const filtered = (data.models ?? [])
          .map((model) => ({
            id: model.id,
            name: model.name,
            engineUrl: model.parts_engine_url || undefined,
            chassisUrl: model.parts_chassis_url || undefined,
          }))
          .filter((model) => model.engineUrl || model.chassisUrl);
        setItems(filtered);
      })
      .catch(() => {
        if (active) setError("파츠리스트를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const title = useMemo(() => {
    if (loading) return "불러오는 중...";
    if (error) return "오류";
    return "파츠리스트 선택";
  }, [loading, error]);

  const openUrl = (url?: string) => {
    if (!url) return;
    Linking.openURL(url);
  };

  return (
    <>
      <Pressable style={styles.launcher} onPress={() => setOpen(true)}>
        <Text style={styles.launcherText}>파츠리스트</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>
                  등록된 파츠리스트가 있는 모델만 표시됩니다.
                </Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#0f172a" />
              </View>
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : items.length === 0 ? (
              <Text style={styles.emptyText}>등록된 파츠리스트가 없습니다.</Text>
            ) : (
              <ScrollView contentContainerStyle={styles.list}>
                {items.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{item.id}</Text>
                    {item.name ? (
                      <Text style={styles.cardSub}>{item.name}</Text>
                    ) : null}
                    <View style={styles.buttonRow}>
                      {item.engineUrl ? (
                        <Pressable
                          style={styles.primaryButton}
                          onPress={() => openUrl(item.engineUrl)}
                        >
                          <Text style={styles.primaryButtonText}>엔진 파츠리스트</Text>
                        </Pressable>
                      ) : null}
                      {item.chassisUrl ? (
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => openUrl(item.chassisUrl)}
                        >
                          <Text style={styles.secondaryButtonText}>차대 파츠리스트</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  launcher: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    backgroundColor: "#f8fafc",
  },
  launcherText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0f172a",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    padding: 16,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  closeButton: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  closeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  center: {
    paddingVertical: 24,
    alignItems: "center",
  },
  errorText: {
    marginTop: 12,
    color: "#ef4444",
    fontSize: 12,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 12,
    color: "#94a3b8",
  },
  list: {
    paddingTop: 12,
    gap: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  buttonRow: {
    marginTop: 10,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: "#0f172a",
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#0f172a",
    paddingVertical: 8,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600",
  },
});
