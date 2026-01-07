import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { buildUrl, fetchJson } from "@/lib/api";
import type { ModelEntry, SpecRow } from "@/lib/types";
import { useAdminAuth } from "@/lib/admin";
import AdminSection from "@/components/AdminSection";

const CATEGORIES = [
  { id: "all", label: "전체" },
  { id: "torque", label: "Torque" },
  { id: "oil", label: "Oil" },
  { id: "clearance", label: "Clearance" },
  { id: "consumable", label: "Consumable" },
];

export default function SpecsScreen() {
  const auth = useAdminAuth();
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [model, setModel] = useState("all");
  const [category, setCategory] = useState("all");
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ models: ModelEntry[] }>(buildUrl("/api/models"))
      .then((data) => setModels(data.models ?? []))
      .catch(() => setModels([]));
  }, []);

  const modelOptions = useMemo(() => {
    const ids = models.map((item) => item.id).filter(Boolean);
    const unique = Array.from(new Set(ids));
    return ["all", ...unique];
  }, [models]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = buildUrl("/api/specs", { model, category });
        const data = await fetchJson<{ specs: SpecRow[] }>(url);
        setSpecs(data.specs ?? []);
      } catch {
        setError("스펙을 불러오지 못했습니다.");
        setSpecs([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [model, category]);

  const handleUpload = async () => {
    if (!auth.token) {
      setUploadMessage("관리자 로그인 후 업로드할 수 있습니다.");
      return;
    }

    const pick = await DocumentPicker.getDocumentAsync({
      type: [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    });

    if (pick.canceled || !pick.assets?.length) return;
    const file = pick.assets[0];
    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: file.name ?? "specs.xlsx",
      type: file.mimeType ?? "application/octet-stream",
    } as unknown as Blob);

    try {
      const response = await fetch(buildUrl("/api/specs/import"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
        body: formData,
      });
      if (!response.ok) {
        setUploadMessage("업로드 실패");
        return;
      }
      setUploadMessage("업로드 완료");
    } catch {
      setUploadMessage("업로드 실패");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>스펙</Text>
      <Text style={styles.subtitle}>모델별 스펙을 빠르게 확인하세요.</Text>

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

        <Text style={styles.sectionTitle}>카테고리</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setCategory(item.id)}
              style={[styles.chip, category === item.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <AdminSection auth={auth} />
      {auth.role === "admin" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>스펙 업로드</Text>
          <Pressable style={styles.primaryButton} onPress={handleUpload}>
            <Text style={styles.primaryButtonText}>CSV/XLSX 업로드</Text>
          </Pressable>
          {uploadMessage ? <Text style={styles.helper}>{uploadMessage}</Text> : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : null}

      {error ? <Text style={styles.helper}>{error}</Text> : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>스펙 목록</Text>
        {specs.length ? (
          specs.map((item) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{item.item}</Text>
              <Text style={styles.itemMeta}>{item.model} · {item.category}</Text>
              <Text style={styles.itemValue}>{item.value}</Text>
              {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.helper}>표시할 스펙이 없습니다.</Text>
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
    marginTop: 8,
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
  itemValue: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  itemNote: {
    marginTop: 4,
    fontSize: 12,
    color: "#475569",
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
