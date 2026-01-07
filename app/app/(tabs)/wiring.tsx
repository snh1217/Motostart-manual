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
import { buildUrl, fetchJson, WEB_BASE_URL } from "@/lib/api";
import type { WiringEntry } from "@/lib/types";
import { useAdminAuth } from "@/lib/admin";
import AdminSection from "@/components/AdminSection";

export default function WiringScreen() {
  const router = useRouter();
  const auth = useAdminAuth();
  const [entries, setEntries] = useState<WiringEntry[]>([]);
  const [model, setModel] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadModel, setUploadModel] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadNote, setUploadNote] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchJson<WiringEntry[]>(buildUrl("/data/wiring_manifest.json"))
      .then((data) => setEntries(data ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const modelOptions = useMemo(() => {
    const unique = new Set(entries.map((item) => item.model));
    return ["all", ...Array.from(unique).sort()];
  }, [entries]);

  const filtered = entries.filter((item) => {
    if (model !== "all" && item.model !== model) return false;
    if (!query.trim()) return true;
    const haystack = [item.title, item.note, ...(item.tags ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const openViewer = (entry: WiringEntry) => {
    const url = entry.file.startsWith("http")
      ? entry.file
      : `${WEB_BASE_URL}${entry.file}`;
    router.push({
      pathname: "/viewer",
      params: {
        url,
        title: entry.title,
      },
    });
  };

  const handleUpload = async () => {
    if (!auth.token) {
      setUploadMessage("관리자 로그인 후 업로드할 수 있습니다.");
      return;
    }
    const pick = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/png", "image/jpeg"],
    });
    if (pick.canceled || !pick.assets?.length) return;
    const file = pick.assets[0];

    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: file.name ?? "wiring.pdf",
      type: file.mimeType ?? "application/octet-stream",
    } as unknown as Blob);
    formData.append("model", uploadModel.trim());
    formData.append("title", uploadTitle.trim());
    formData.append("tags", uploadTags.trim());
    formData.append("note", uploadNote.trim());

    try {
      const response = await fetch(buildUrl("/api/wiring/upload"), {
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
      <Text style={styles.title}>회로도</Text>
      <Text style={styles.subtitle}>모델과 키워드로 회로도를 찾으세요.</Text>

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
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="예: 시동, 충전, ABS"
          style={styles.input}
        />
      </View>

      <AdminSection auth={auth} />
      {auth.role === "admin" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>회로도 업로드</Text>
          <TextInput
            value={uploadModel}
            onChangeText={setUploadModel}
            placeholder="모델"
            style={styles.input}
          />
          <TextInput
            value={uploadTitle}
            onChangeText={setUploadTitle}
            placeholder="제목"
            style={styles.input}
          />
          <TextInput
            value={uploadTags}
            onChangeText={setUploadTags}
            placeholder="태그 (콤마 구분)"
            style={styles.input}
          />
          <TextInput
            value={uploadNote}
            onChangeText={setUploadNote}
            placeholder="메모"
            style={styles.input}
          />
          <Pressable style={styles.primaryButton} onPress={handleUpload}>
            <Text style={styles.primaryButtonText}>파일 선택 후 업로드</Text>
          </Pressable>
          {uploadMessage ? <Text style={styles.helper}>{uploadMessage}</Text> : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>회로도 목록</Text>
        {filtered.length ? (
          filtered.map((item) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>{item.model}</Text>
              {item.note ? <Text style={styles.itemSub}>{item.note}</Text> : null}
              <Pressable style={styles.linkButton} onPress={() => openViewer(item)}>
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
  itemSub: {
    marginTop: 6,
    fontSize: 13,
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
