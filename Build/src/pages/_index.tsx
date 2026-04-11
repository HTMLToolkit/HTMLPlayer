import { useKomorebi } from "../hooks/useKomorebi";
import { AppShell } from "../ui/AppShell";

export default function IndexPage() {
  const komorebi = useKomorebi({
    autoPlay: false,
    persistLibrary: true,
    persistSettings: true,
  });
  return <AppShell komorebi={komorebi} />;
}
