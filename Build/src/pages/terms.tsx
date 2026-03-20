import { LegalPage } from "../ui/pages/LegalPage";
import { termsOfService } from "../data/legal";

export default function TermsPage() {
  return (
    <LegalPage
      document={termsOfService}
      backLink="/"
      backLabel="Back to HTMLPlayer"
    />
  );
}
