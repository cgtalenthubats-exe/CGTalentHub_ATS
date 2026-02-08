"use client";

import { useState, useEffect } from "react";
import { N8nConfig, getN8nConfigs, updateN8nConfig } from "@/app/actions/admin-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Send, Webhook } from "lucide-react";
import { toast } from "sonner";

export function N8nIntegrations() {
    const [configs, setConfigs] = useState<N8nConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{ url: string, method: 'GET' | 'POST' }>({ url: '', method: 'POST' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        setLoading(true);
        const data = await getN8nConfigs();
        setConfigs(data);
        setLoading(false);
    };

    const handleEdit = (config: N8nConfig) => {
        setEditingId(config.id);
        setEditForm({ url: config.url, method: config.method });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditForm({ url: '', method: 'POST' });
    };

    const handleSave = async (id: number) => {
        setSaving(true);
        const res = await updateN8nConfig(id, editForm.url, editForm.method);
        if (res.success) {
            toast.success("Configuration updated successfully");
            setEditingId(null);
            loadConfigs();
        } else {
            toast.error("Failed to update: " + res.error);
        }
        setSaving(false);
    };

    const handleTest = (url: string, method: string) => {
        // Just open in new tab if GET, otherwise copy to clipboard?
        if (method === 'GET') {
            window.open(url, '_blank');
        } else {
            navigator.clipboard.writeText(url);
            toast.success("URL copied to clipboard");
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Webhook className="w-5 h-5 text-indigo-600" />
                    n8n Webhook Configurations
                </CardTitle>
                <CardDescription>
                    Manage the connection endpoints for your n8n workflows.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Service Name</TableHead>
                            <TableHead>Webhook URL</TableHead>
                            <TableHead className="w-[100px]">Method</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {configs.map((config) => (
                            <TableRow key={config.id}>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span>{config.name}</span>
                                        <span className="text-xs text-slate-500 font-normal">{config.description}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {editingId === config.id ? (
                                        <Input
                                            value={editForm.url}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, url: e.target.value }))}
                                            placeholder="https://n8n.example.com/webhook/..."
                                            className="font-mono text-xs"
                                        />
                                    ) : (
                                        <div className="font-mono text-xs text-slate-600 truncate max-w-[400px]" title={config.url}>
                                            {config.url}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editingId === config.id ? (
                                        <Select
                                            value={editForm.method}
                                            onValueChange={(v: 'GET' | 'POST') => setEditForm(prev => ({ ...prev, method: v }))}
                                        >
                                            <SelectTrigger className="w-[90px] h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="GET">GET</SelectItem>
                                                <SelectItem value="POST">POST</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Badge variant="outline" className={config.method === 'POST' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}>
                                            {config.method}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {editingId === config.id ? (
                                            <>
                                                <Button size="sm" onClick={() => handleSave(config.id)} disabled={saving} className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700">
                                                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving} className="h-8 w-8 p-0">
                                                    <span className="sr-only">Cancel</span>
                                                    <span className="text-xs">✕</span>
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button size="sm" variant="secondary" onClick={() => handleEdit(config)} className="h-8 text-xs">
                                                    Edit
                                                </Button>
                                                {/* <Button size="sm" variant="ghost" onClick={() => handleTest(config.url, config.method)} className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600">
                                                    <Send className="w-3 h-3" />
                                                </Button> */}
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
