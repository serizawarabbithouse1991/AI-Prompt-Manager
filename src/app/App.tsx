import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useInitializeApp } from "@/features/files/hooks";
import { useFileStore } from "@/features/files/store";
import { listTags } from "@/lib/tauri";
import { getPlatform } from "@/lib/platform";

export function App() {
  useInitializeApp();
  const setPlatformName = useFileStore((s) => s.setPlatformName);
  const setAllTags = useFileStore((s) => s.setAllTags);

  useEffect(() => {
    void getPlatform().then(setPlatformName);
    void listTags().then(setAllTags).catch(() => setAllTags([]));
  }, [setPlatformName, setAllTags]);

  return <AppShell />;
}

export default App;
