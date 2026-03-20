export interface LegalSection {
  heading: string;
  content: string | string[];
}

export interface LegalDocument {
  title: string;
  effectiveDate: string;
  sections: LegalSection[];
  contact: string;
}

export const privacyPolicy: LegalDocument = {
  title: "HTMLPlayer Privacy Policy",
  effectiveDate: "9/23/2025",
  sections: [
    {
      heading: "1. Introduction",
      content: `HTMLPlayer respects your privacy. Since the App is primarily client-side, 
we do not collect personal data unless you interact with external services 
(e.g., Discord integration).`,
    },
    {
      heading: "2. Data Collection",
      content: [
        "The App does not collect personal information by default.",
        "Optional Discord integration may send limited information (username, current activity) to Discord's servers for the purpose of updating your music activity.",
      ],
    },
    {
      heading: "3. Cookies and Tracking",
      content:
        "HTMLPlayer does not use cookies or trackers for analytics or advertising.",
    },
    {
      heading: "4. Third-Party Services",
      content: `Discord integration is managed via OAuth; your authorization is handled by 
Discord directly. HTMLPlayer does not store Discord credentials or share 
data outside the Discord API.`,
    },
    {
      heading: "5. Security",
      content: `All client-side operations run in your browser; no server-side storage of 
music or personal data occurs. We take no responsibility for security 
vulnerabilities in your browser or Discord.`,
    },
    {
      heading: "6. Data Sharing",
      content:
        "HTMLPlayer does not sell, trade, or share personal information with third parties, except through authorized use of Discord features.",
    },
    {
      heading: "7. Updates to Privacy Policy",
      content:
        "We may update this Privacy Policy as HTMLPlayer evolves. Continued use indicates acceptance of the latest policy.",
    },
    {
      heading: "8. Contact",
      content: "For privacy questions, contact: nellowtcs@gmail.com",
    },
  ],
  contact: "nellowtcs@gmail.com",
};

export const termsOfService: LegalDocument = {
  title: "HTMLPlayer Terms of Service (TOS)",
  effectiveDate: "9/23/2025",
  sections: [
    {
      heading: "1. Acceptance of Terms",
      content:
        'By using HTMLPlayer (the "App"), you agree to these Terms of Service. If you do not agree, do not use the App.',
    },
    {
      heading: "2. Use of the App",
      content: [
        "HTMLPlayer is a free, open-source music player.",
        "All core functionality runs client-side in your browser; we do not collect usage data except when explicitly interacting with external services like Discord.",
        "You may use the App for personal, non-commercial purposes.",
      ],
    },
    {
      heading: "3. Intellectual Property",
      content: `HTMLPlayer and its source code are licensed under the 
MIT License. You may copy, modify, or redistribute the App according to the MIT License terms.`,
    },
    {
      heading: "4. Discord Integration",
      content: `The App may optionally integrate with Discord to display music activity. 
Access to Discord features requires you to authorize HTMLPlayer via 
Discord OAuth. HTMLPlayer does not store your Discord credentials.`,
    },
    {
      heading: "5. Beta Disclaimer",
      content:
        "HTMLPlayer is currently in beta. Features may be unstable or incomplete. Use at your own risk.",
    },
    {
      heading: "6. No Warranty",
      content: `The App is provided "as-is" without warranty of any kind, either express 
or implied. The developers are not liable for any damages arising from the 
use or inability to use HTMLPlayer.`,
    },
    {
      heading: "7. Limitation of Liability",
      content:
        "You use HTMLPlayer entirely at your own risk. Developers are not responsible for any loss, data corruption, or other issues resulting from your use of the App.",
    },
    {
      heading: "8. Modifications to Terms",
      content:
        "We may update these Terms at any time. Continued use constitutes acceptance of the updated Terms.",
    },
    {
      heading: "9. Contact",
      content: "For questions about these Terms, contact: nellowtcs@gmail.com",
    },
  ],
  contact: "nellowtcs@gmail.com",
};
