import { ContentSection } from "../components/content-section";
import { AccountForm } from "./account-form";

export function SettingsAccount() {
  return (
    <ContentSection
      title="Account & Workspace"
      desc="Manage your Agentic AI account, workspace preferences, language, and timezone."
    >
      <AccountForm />
    </ContentSection>
  );
}
