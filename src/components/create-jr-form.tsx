"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface CreateJobRequisitionFormProps {
    onCancel: () => void;
    onSuccess: (newJR: any) => void;
}

export function CreateJobRequisitionForm({ onCancel, onSuccess }: CreateJobRequisitionFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        position: "",
        department: "",
        division: "",
        hiring_manager_name: "",
        headcount: 1,
        location: "Bangkok",
        description: ""
    });

    const handleChange = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Import action dynamically
            const { createJobRequisition } = await import("@/app/actions/requisitions");
            const newJR = await createJobRequisition(formData);
            if (newJR) {
                onSuccess(newJR);
            }
        } catch (error) {
            console.error("Failed to create JR", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="position">Position Title <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(v) => handleChange("position", v)} defaultValue={formData.position}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Position" />
                        </SelectTrigger>
                        <SelectContent>
                            {/* Dummy Data */}
                            <SelectItem value="Senior Software Engineer">Senior Software Engineer</SelectItem>
                            <SelectItem value="Product Manager">Product Manager</SelectItem>
                            <SelectItem value="UX Designer">UX Designer</SelectItem>
                            <SelectItem value="Data Scientist">Data Scientist</SelectItem>
                            <SelectItem value="HR Specialist">HR Specialist</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="division">Division (BU)</Label>
                    <Select onValueChange={(v) => handleChange("division", v)} defaultValue={formData.division}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Business Unit" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Corporate">Corporate</SelectItem>
                            <SelectItem value="Technology">Technology</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="Operations">Operations</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="department">Department (Sub-BU)</Label>
                    <Select onValueChange={(v) => handleChange("department", v)} defaultValue={formData.department}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Platform Engineering">Platform Engineering</SelectItem>
                            <SelectItem value="Mobile Development">Mobile Development</SelectItem>
                            <SelectItem value="Human Resources">Human Resources</SelectItem>
                            <SelectItem value="Direct Sales">Direct Sales</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="hiring_manager">Hiring Manager</Label>
                    <Select onValueChange={(v) => handleChange("hiring_manager_name", v)} defaultValue={formData.hiring_manager_name}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Manager" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Somchai Jai-dee">Somchai Jai-dee</SelectItem>
                            <SelectItem value="Somsri Mee-ngern">Somsri Mee-ngern</SelectItem>
                            <SelectItem value="John Doe">John Doe</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="headcount">Target Headcount</Label>
                    <Select onValueChange={(v) => handleChange("headcount", parseInt(v))} defaultValue={formData.headcount.toString()}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Headcount" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Select onValueChange={(v) => handleChange("location", v)} defaultValue={formData.location}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Location" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Bangkok">Bangkok</SelectItem>
                            <SelectItem value="Chiang Mai">Chiang Mai</SelectItem>
                            <SelectItem value="Phuket">Phuket</SelectItem>
                            <SelectItem value="Remote">Remote</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Job Description (Brief)</Label>
                <Textarea
                    id="description"
                    placeholder="Key responsibilities and requirements..."
                    className="min-h-[100px]"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground">
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                        </>
                    ) : (
                        "Create Requisition"
                    )}
                </Button>
            </div>
        </form>
    );
}
