import { Icon } from "../components/shared/Icon";
import type { LegalDocument } from "../../data/legal";
import styles from "./LegalPage.module.css";

interface LegalPageProps {
  document: LegalDocument;
  backLink: string;
  backLabel: string;
}

export const LegalPage = ({
  document,
  backLink,
  backLabel,
}: LegalPageProps) => {
  return (
    <div className={styles.container}>
      <a href={backLink} className={styles.backLink}>
        <Icon name="arrowLeft" size={16} decorative />
        <span>{backLabel}</span>
      </a>

      <article className={styles.content}>
        <h1 className={styles.title}>{document.title}</h1>
        <p className={styles.effectiveDate}>
          <strong>Effective Date:</strong> {document.effectiveDate}
        </p>

        {document.sections.map((section, index) => (
          <section key={index} className={styles.section}>
            <h2 className={styles.sectionHeading}>{section.heading}</h2>
            {Array.isArray(section.content) ? (
              <ul className={styles.list}>
                {section.content.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.paragraph}>{section.content}</p>
            )}
          </section>
        ))}
      </article>
    </div>
  );
};
