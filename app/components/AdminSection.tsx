import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { AdminAuthState } from "@/lib/admin";

export default function AdminSection({ auth }: { auth: AdminAuthState }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    const ok = await auth.login(code);
    setMessage(ok ? "관리자 로그인 완료" : "로그인 실패");
  };

  const handleLogout = async () => {
    await auth.logout();
    setCode("");
    setMessage("로그아웃 되었습니다");
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>관리자</Text>
      {auth.role === "admin" ? (
        <View>
          <Text style={styles.helper}>관리자 모드 활성화</Text>
          <Pressable style={styles.secondaryButton} onPress={handleLogout}>
            <Text style={styles.secondaryButtonText}>로그아웃</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="관리자 코드 입력"
            style={styles.input}
            secureTextEntry
          />
          <Pressable style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>관리자 로그인</Text>
          </Pressable>
        </View>
      )}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
    paddingVertical: 10,
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
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "600",
  },
  helper: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
  },
  message: {
    marginTop: 8,
    fontSize: 12,
    color: "#0f172a",
  },
});
