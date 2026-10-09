import { useKomorebi } from "../hooks/useKomorebi";
import { AppShell } from "../ui/AppShell";

export default function IndexPage() {
  const komorebi = useKomorebi({
    autoPlay: true,
    persistLibrary: true,
  });
  return <AppShell komorebi={komorebi} />;
}
