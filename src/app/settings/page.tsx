"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { N8nIntegrations } from "@/components/settings/n8n-integrations";
import { UserManagement } from "@/components/settings/user-management";
import { ChangelogViewer } from "@/components/settings/changelog-viewer";
import { AppGuidelines } from "@/components/settings/app-guidelines";
import { StatusMasterSettings } from "@/components/settings/status-master-settings";
import { AISettings } from "@/components/settings/ai-settings";
import { Settings, Sliders, Webhook, Users, History, BookOpen, Tag, Sparkles } from "lucide-react";
import { Toaster } from "sonner";

export default function SettingsPage() {
    return (
        <div className="container mx-auto p-6 space-y-6 max-w-5xl">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">Settings</h1>
                <p className="text-muted-foreground mt-1">Manage system configurations and integrations.</p>
            </div>

            <Tabs defaultValue="integrations" className="space-y-4">
                <TabsList className="bg-slate-100 p-1">
                    <TabsTrigger value="general" className="gap-2" disabled>
                        <Settings className="w-4 h-4" /> General
                    </TabsTrigger>
                    <TabsTrigger value="integrations" className="gap-2">
                        <Webhook className="w-4 h-4" /> Integrations
                    </TabsTrigger>
                    <TabsTrigger value="ai-config" className="gap-2">
                        <Sparkles className="w-4 h-4" /> AI Configuration
                    </TabsTrigger>
                    <TabsTrigger value="users" className="gap-2">
                        <Users className="w-4 h-4" /> Users
                    </TabsTrigger>
                    <TabsTrigger value="guidelines" className="gap-2">
                        <BookOpen className="w-4 h-4" /> Guidelines
                    </TabsTrigger>
                    <TabsTrigger value="pipeline" className="gap-2">
                        <Tag className="w-4 h-4" /> Pipeline Statuses
                    </TabsTrigger>
                    <TabsTrigger value="changelog" className="gap-2">
                        <History className="w-4 h-4" /> Changelog
                    </TabsTrigger>
                    <TabsTrigger value="advanced" className="gap-2" disabled>
                        <Sliders className="w-4 h-4" /> Advanced
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <div className="text-sm text-slate-500 p-4 border rounded-lg bg-slate-50">
                        General settings coming soon.
                    </div>
                </TabsContent>

                <TabsContent value="integrations" className="space-y-4">
                    <div className="grid gap-6">
                        <N8nIntegrations />
                    </div>
                </TabsContent>

                <TabsContent value="ai-config" className="space-y-4">
                    <AISettings />
                </TabsContent>

                <TabsContent value="users" className="space-y-4">
                    <UserManagement />
                </TabsContent>

                <TabsContent value="guidelines" className="space-y-4">
                    <div className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm">
                        <AppGuidelines />
                    </div>
                </TabsContent>

                <TabsContent value="pipeline" className="space-y-4">
                    <div className="border border-slate-100 rounded-xl p-5 bg-white shadow-sm">
                        <StatusMasterSettings />
                    </div>
                </TabsContent>

                <TabsContent value="changelog" className="space-y-4">
                    <div className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm">
                        <ChangelogViewer />
                    </div>
                </TabsContent>

                <TabsContent value="advanced">
                    <div className="text-sm text-slate-500 p-4 border rounded-lg bg-slate-50">
                        Advanced settings coming soon.
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
