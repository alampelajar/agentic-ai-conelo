import { ArrowLeft, Bot, Code2, Database, Globe, Wrench } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { ThemeSwitch } from "@/components/theme-switch";
import { ConfigDrawer } from "@/components/config-drawer";
import { ProfileDropdown } from "@/components/profile-dropdown";
import i18n from "@/i18n";

export function CreateAgent() {
  const { t } = useTranslation();

  return (
    <>
      <Header fixed>
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </div>

          <div>
            <p className="text-sm font-semibold">{t("agentPage.create")}</p>

            <p className="text-xs text-muted-foreground">
              {t("agentPage.management")}
            </p>
          </div>
        </div>

        <div className="ms-auto flex items-center gap-2">
          <select
            value={i18n.language}
            onChange={(event) => i18n.changeLanguage(event.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="id">🇮🇩 Indonesia</option>
            <option value="en">🇬🇧 English</option>
          </select>

          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className="mx-auto w-full max-w-4xl">
          {/* Back */}
          <Button variant="ghost" asChild className="mb-5">
            <Link to="/users">
              <ArrowLeft className="me-2 size-4" />
              {t("agentPage.backToAgents")}
            </Link>
          </Button>

          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">
              {t("agentPage.createTitle")}
            </h1>

            <p className="mt-1 text-muted-foreground">
              {t("agentPage.createSubtitle")}
            </p>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t("agentPage.basicInformation")}</CardTitle>

                <CardDescription>
                  {t("agentPage.basicInformationDescription")}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Agent Name */}
                <div className="space-y-2">
                  <Label htmlFor="agent-name">{t("agentPage.agentName")}</Label>

                  <Input
                    id="agent-name"
                    placeholder={t("agentPage.agentNamePlaceholder")}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="agent-description">
                    {t("agentPage.description")}
                  </Label>

                  <Textarea
                    id="agent-description"
                    placeholder={t("agentPage.descriptionPlaceholder")}
                    className="min-h-[100px] resize-none"
                  />
                </div>

                {/* Agent Type */}
                <div className="space-y-2">
                  <Label>{t("agentPage.agentType")}</Label>

                  <Select defaultValue="development">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="development">
                        {t("agentPage.development")}
                      </SelectItem>

                      <SelectItem value="research">
                        {t("agentPage.research")}
                      </SelectItem>

                      <SelectItem value="testing">
                        {t("agentPage.testing")}
                      </SelectItem>

                      <SelectItem value="documentation">
                        {t("agentPage.documentation")}
                      </SelectItem>

                      <SelectItem value="design">
                        {t("agentPage.design")}
                      </SelectItem>

                      <SelectItem value="analysis">
                        {t("agentPage.analysis")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Agent Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>{t("agentPage.instructions")}</CardTitle>

                <CardDescription>
                  {t("agentPage.instructionsDescription")}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Textarea
                  placeholder={t("agentPage.instructionsPlaceholder")}
                  className="min-h-[160px] resize-none"
                />
              </CardContent>
            </Card>

            {/* Tools */}
            <Card>
              <CardHeader>
                <CardTitle>{t("agentPage.tools")}</CardTitle>

                <CardDescription>
                  {t("agentPage.toolsDescription")}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ToolCard
                    icon={Code2}
                    title={t("agentPage.codeTool")}
                    description={t("agentPage.codeToolDescription")}
                  />

                  <ToolCard
                    icon={Globe}
                    title={t("agentPage.browserTool")}
                    description={t("agentPage.browserToolDescription")}
                  />

                  <ToolCard
                    icon={Database}
                    title={t("agentPage.databaseTool")}
                    description={t("agentPage.databaseToolDescription")}
                  />

                  <ToolCard
                    icon={Wrench}
                    title={t("agentPage.apiTool")}
                    description={t("agentPage.apiToolDescription")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" asChild>
                <Link to="/users">{t("agentPage.cancel")}</Link>
              </Button>

              <Button type="button">
                <Bot className="me-2 size-4" />
                {t("agentPage.createAgent")}
              </Button>
            </div>
          </div>
        </div>
      </Main>
    </>
  );
}

function ToolCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      className="flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4" />
      </div>

      <div>
        <p className="text-sm font-medium">{title}</p>

        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  );
}
