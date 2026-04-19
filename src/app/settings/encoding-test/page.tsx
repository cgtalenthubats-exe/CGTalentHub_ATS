"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Papa from "papaparse"
import { saveTestEncodingNames, getTestEncodingLogs, clearTestEncodingLogs } from "@/app/actions/test-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/lib/notifications"
import { UploadCloud, Download, Trash2, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react"
import { AtsBreadcrumb } from "@/components/ats-breadcrumb"

export default function EncodingTestPage() {
    const [encoding, setEncoding] = useState<string>("UTF-8")
    const [uploading, setUploading] = useState(false)
    const [logs, setLogs] = useState<any[]>([])
    const [loadingLogs, setLoadingLogs] = useState(true)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        setLoadingLogs(true)
        try {
            const data = await getTestEncodingLogs()
            setLogs(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingLogs(false)
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        
        // Use FileReader to read as string with specific encoding if needed
        const reader = new FileReader()
        reader.onload = async (event) => {
            const csvData = event.target?.result as string
            
            Papa.parse(csvData, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const rows = results.data as any[]
                    const names = rows.map(r => r.Name || r.name || Object.values(r)[0]).filter(Boolean) as string[]
                    
                    if (names.length === 0) {
                        toast.error("No names found in CSV. Expected a 'Name' column.")
                        setUploading(false)
                        return
                    }

                    try {
                        await saveTestEncodingNames(names, encoding, "Encoding Tester")
                        toast.success(`Uploaded ${names.length} names successfully!`)
                        fetchLogs()
                    } catch (err: any) {
                        toast.error("Failed to save to database")
                    } finally {
                        setUploading(false)
                        if (fileInputRef.current) fileInputRef.current.value = ""
                    }
                },
                error: (err) => {
                    toast.error("CSV Parse Error: " + err.message)
                    setUploading(false)
                }
            })
        }

        reader.onerror = () => {
            toast.error("Failed to read file")
            setUploading(false)
        }

        // IMPORTANT: Use the selected encoding for FileReader
        reader.readAsText(file, encoding)
    }

    const downloadTemplate = () => {
        // Names with European special characters: Möller, François, Stéphane, García
        const csvContent = "Name\nMöller\nFrançois\nStéphane\nGarcía\nZüli\nRené"
        
        // We create a blob with the selected encoding
        // Note: For Windows-1252, we use standard text/csv but for the browser to "download" it correctly
        // as a non-UTF8 file is tricky without a library. 
        // However, most modern browsers handle the blob as UTF-8 by default.
        // To really test Windows-1252, the user should export from Excel.
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `encoding_template_${encoding}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.info("Template downloaded as UTF-8. Use Excel to save as 'CSV (Comma delimited)' to test Windows-1252.")
    }

    const handleClear = async () => {
        if (!confirm("Clear all test logs?")) return
        try {
            await clearTestEncodingLogs()
            toast.success("Logs cleared")
            fetchLogs()
        } catch (err) {
            toast.error("Failed to clear logs")
        }
    }

    return (
        <div className="container mx-auto p-6 space-y-6 max-w-4xl">
            <AtsBreadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'Encoding Sandbox' }]} />
            
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        Encoding Sandbox <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Test Tool</Badge>
                    </h1>
                    <p className="text-muted-foreground mt-1">Test how European characters (Möller, François) render with different CSV encodings.</p>
                </div>
                <Button variant="destructive" size="sm" onClick={handleClear} className="h-9">
                    <Trash2 className="h-4 w-4 mr-2" /> Clear Logs
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Configuration Card */}
                <Card className="md:col-span-1 shadow-sm border-slate-200">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Step 1: Select Encoding</CardTitle>
                        <CardDescription>Choose the encoding your file was saved with.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <RadioGroup value={encoding} onValueChange={setEncoding} className="gap-4">
                            <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                <RadioGroupItem value="UTF-8" id="utf8" />
                                <Label htmlFor="utf8" className="font-bold cursor-pointer flex-1">
                                    UTF-8
                                    <span className="block text-xs font-normal text-slate-500 mt-0.5">Standard global encoding.</span>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                <RadioGroupItem value="Windows-1252" id="win1252" />
                                <Label htmlFor="win1252" className="font-bold cursor-pointer flex-1">
                                    Windows-1252
                                    <span className="block text-xs font-normal text-slate-500 mt-0.5">Common European Excel export.</span>
                                </Label>
                            </div>
                        </RadioGroup>

                        <div className="pt-4 border-t border-slate-100">
                            <h4 className="text-sm font-bold text-slate-900 mb-2">Step 2: Upload File</h4>
                            <div 
                                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept=".csv" 
                                    onChange={handleFileUpload} 
                                />
                                {uploading ? (
                                    <Loader2 className="h-10 w-10 mx-auto text-indigo-500 animate-spin" />
                                ) : (
                                    <UploadCloud className="h-10 w-10 mx-auto text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                )}
                                <p className="mt-2 text-sm font-medium text-slate-600">Click to upload CSV</p>
                            </div>
                        </div>

                        <Button variant="outline" className="w-full h-11 border-slate-200" onClick={downloadTemplate}>
                            <Download className="h-4 w-4 mr-2" /> Download Template
                        </Button>
                    </CardContent>
                </Card>

                {/* Results Table */}
                <Card className="md:col-span-2 shadow-sm border-slate-200">
                    <CardHeader className="pb-0">
                        <CardTitle className="text-lg">Step 3: Verify Results</CardTitle>
                        <CardDescription>If you see "boxes" or "mojibake", the encoding was wrong.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 pt-4">
                        <div className="rounded-none border-t border-slate-100">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="w-[200px] font-bold">Uploaded Name</TableHead>
                                        <TableHead className="font-bold">Encoding Used</TableHead>
                                        <TableHead className="text-right font-bold">Time</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingLogs ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                                Loading results...
                                            </TableCell>
                                        </TableRow>
                                    ) : logs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                                                <AlertCircle className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                                                No test data yet. Try uploading a CSV!
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        logs.map((log) => (
                                            <TableRow key={log.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <TableCell className="font-semibold text-slate-900 py-4">
                                                    {log.name.includes('') || log.name.includes('') ? (
                                                        <span className="flex items-center text-red-600 bg-red-50 px-2 py-1 rounded inline-flex">
                                                            <AlertCircle className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                                                            {log.name}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-flex">
                                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                                                            {log.name}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-slate-500 font-medium">
                                                    {log.note.replace('Encoding used: ', '')}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-400 text-xs tabular-nums">
                                                    {new Date(log.created_at).toLocaleTimeString()}
                                                </TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-4">
                <div className="bg-amber-100 p-2.5 rounded-full h-fit">
                    <Info className="h-5 w-5 text-amber-700" />
                </div>
                <div className="space-y-1">
                    <h4 className="font-bold text-amber-900">How to use this sandbox:</h4>
                    <ul className="text-sm text-amber-800 list-disc ml-4 space-y-1">
                        <li>Download the template and open it in <strong>Excel</strong>.</li>
                        <li>Save it as <strong>CSV (Comma delimited) (*.csv)</strong>. Excel will likely save it as <strong>Windows-1252</strong>.</li>
                        <li>Back here, try uploading with <strong>UTF-8</strong> (it should show boxes).</li>
                        <li>Now, switch the toggle to <strong>Windows-1252</strong> and upload again. It should be perfect!</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

function Badge({ children, variant, className }: any) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-900 ${className}`}>
            {children}
        </span>
    )
}
