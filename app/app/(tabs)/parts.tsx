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
import * as DocumentPicker from "expo-document-picker";
import { buildUrl, fetchJson } from "@/lib/api";
import type { ModelEntry, PartEntry, PartPhoto, PartStep } from "@/lib/types";
import { useAdminAuth } from "@/lib/admin";
import AdminSection from "@/components/AdminSection";

const SYSTEMS = [
  { id: "all", label: "전체" },
  { id: "engine", label: "엔진" },
  { id: "chassis", label: "차대" },
  { id: "electrical", label: "전장" },
  { id: "other", label: "기타" },
];

export default function PartsScreen() {
  const router = useRouter();
  const auth = useAdminAuth();
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [model, setModel] = useState("all");
  const [system, setSystem] = useState("all");
  const [query, setQuery] = useState("");
  const [parts, setParts] = useState<PartEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [partId, setPartId] = useState("");
  const [partModel, setPartModel] = useState("");
  const [partSystem, setPartSystem] = useState("engine");
  const [partName, setPartName] = useState("");
  const [partSummary, setPartSummary] = useState("");
  const [partTags, setPartTags] = useState("");
  const [stepsJson, setStepsJson] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
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

  const loadParts = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl("/api/parts", {
        model: model === "all" ? undefined : model,
        system: system === "all" ? undefined : system,
        q: query.trim() || undefined,
      });
      const data = await fetchJson<{ items: PartEntry[] }>(url);
      setParts(data.items ?? []);
    } catch {
      setError("부품 목록을 불러오지 못했습니다.");
      setParts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParts();
  }, [model, system]);

  const uploadPhoto = async () => {
    if (!auth.token) {
      setUploadMessage("관리자 로그인 후 업로드할 수 있습니다.");
      return;
    }
    if (!partId.trim()) {
      setUploadMessage("부품 ID를 먼저 입력해 주세요.");
      return;
    }
    const pick = await DocumentPicker.getDocumentAsync({
      type: ["image/png", "image/jpeg"],
    });
    if (pick.canceled || !pick.assets?.length) return;
    const file = pick.assets[0];
    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: file.name ?? "photo.jpg",
      type: file.mimeType ?? "application/octet-stream",
    } as unknown as Blob);
    formData.append("model", partModel.trim() || "misc");
    formData.append("partId", partId.trim());

    try {
      const response = await fetch(buildUrl("/api/parts/upload"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data?.url) {
        setUploadMessage("업로드 실패");
        return;
      }
      setPhotoUrls((prev) => [...prev, data.url]);
      setUploadMessage("업로드 완료");
    } catch {
      setUploadMessage("업로드 실패");
    }
  };

  const handleSave = async () => {
    if (!auth.token) {
      setSaveMessage("관리자 로그인 후 저장할 수 있습니다.");
      return;
    }

    let steps: PartStep[] | undefined;
    if (stepsJson.trim()) {
      try {
        steps = JSON.parse(stepsJson) as PartStep[];
      } catch {
        setSaveMessage("작업 절차 JSON 형식이 올바르지 않습니다.");
        return;
      }
    }

    const photos: PartPhoto[] = photoUrls.map((url, idx) => ({
      id: `photo-${Date.now()}-${idx}`,
      url,
    }));

    const payload: PartEntry = {
      id: partId.trim(),
      model: partModel.trim(),
      system: partSystem,
      name: partName.trim(),
      summary: partSummary.trim() || undefined,
      tags: partTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      photos: photos.length ? photos : undefined,
      steps,
    };

    try {
      const response = await fetch(buildUrl("/api/parts"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setSaveMessage("저장 실패");
        return;
      }
      setSaveMessage("저장 완료");
      setPartId("");
      setPartModel("");
      setPartSystem("engine");
      setPartName("");
      setPartSummary("");
      setPartTags("");
      setStepsJson("");
      setPhotoUrls([]);
      loadParts();
    } catch {
      setSaveMessage("저장 실패");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>부품/절차</Text>
      <Text style={styles.subtitle}>모델별 부품 정보와 절차를 확인하세요.</Text>

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

        <Text style={styles.sectionTitle}>시스템</Text>
        <View style={styles.chipRow}>
          {SYSTEMS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setSystem(item.id)}
              style={[styles.chip, system === item.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, system === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="부품명/태그 검색"
          style={styles.input}
          onSubmitEditing={loadParts}
          returnKeyType="search"
        />
        <Pressable style={styles.primaryButton} onPress={loadParts}>
          <Text style={styles.primaryButtonText}>검색</Text>
        </Pressable>
      </View>

      <AdminSection auth={auth} />
      {auth.role === "admin" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>부품 등록</Text>
          <TextInput
            value={partId}
            onChangeText={setPartId}
            placeholder="부품 ID"
            style={styles.input}
          />
          <TextInput
            value={partModel}
            onChangeText={setPartModel}
            placeholder="모델"
            style={styles.input}
          />
          <TextInput
            value={partSystem}
            onChangeText={setPartSystem}
            placeholder="시스템 (engine/chassis/electrical/other)"
            style={styles.input}
          />
          <TextInput
            value={partName}
            onChangeText={setPartName}
            placeholder="부품명"
            style={styles.input}
          />
          <TextInput
            value={partSummary}
            onChangeText={setPartSummary}
            placeholder="요약"
            style={styles.input}
          />
          <TextInput
            value={partTags}
            onChangeText={setPartTags}
            placeholder="태그 (콤마 구분)"
            style={styles.input}
          />
          <TextInput
            value={stepsJson}
            onChangeText={setStepsJson}
            placeholder="작업 절차 JSON (선택)"
            style={styles.input}
          />
          <Pressable style={styles.secondaryButton} onPress={uploadPhoto}>
            <Text style={styles.secondaryButtonText}>사진 업로드</Text>
          </Pressable>
          {photoUrls.length ? (
            <Text style={styles.helper}>업로드된 사진: {photoUrls.length}장</Text>
          ) : null}
          {uploadMessage ? <Text style={styles.helper}>{uploadMessage}</Text> : null}
          <Pressable style={styles.primaryButton} onPress={handleSave}>
            <Text style={styles.primaryButtonText}>부품 저장</Text>
          </Pressable>
          {saveMessage ? <Text style={styles.helper}>{saveMessage}</Text> : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : null}

      {error ? <Text style={styles.helper}>{error}</Text> : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>부품 목록</Text>
        {parts.length ? (
          parts.map((item) => (
            <Pressable
              key={item.id}
              style={styles.listItem}
              onPress={() => router.push(`/parts/${item.id}`)}
            >
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.model} · {item.system}</Text>
              {item.summary ? <Text style={styles.itemNote}>{item.summary}</Text> : null}
            </Pressable>
          ))
        ) : (
          <Text style={styles.helper}>표시할 부품이 없습니다.</Text>
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
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0f172a",
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "600",
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
    color: "#0f172a",
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
});
