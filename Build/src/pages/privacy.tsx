import { LegalPage } from "../ui/pages/LegalPage";
import { privacyPolicy } from "../data/legal";

export default function PrivacyPage() {
  return (
    <LegalPage
      document={privacyPolicy}
      backLink="/"
      backLabel="Back to HTMLPlayer"
    />
  );
}
