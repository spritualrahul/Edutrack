"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Avatar } from "@/components/ui/badge";
import { Plus, Search, Eye, Edit, Trash2 } from "lucide-react";

const teachers = [
  { id: "1", employee_id: "TCH001", name: "Sunita Verma", email: "sunita@dps.edu.in", phone: "9876543220", department: "Mathematics", designation: "Senior Teacher", status: "active" },
  { id: "2", employee_id: "TCH002", name: "Rajiv Sharma", email: "rajiv@dps.edu.in", phone: "9876543221", department: "Physics", designation: "HOD", status: "active" },
  { id: "3", employee_id: "TCH003", name: "Priya Kapoor", email: "priya@dps.edu.in", phone: "9876543222", department: "English", designation: "Senior Teacher", status: "active" },
  { id: "4", employee_id: "TCH004", name: "Amit Saxena", email: "amit@dps.edu.in", phone: "9876543223", department: "Hindi", designation: "Teacher", status: "active" },
  { id: "5", employee_id: "TCH005", name: "Neha Gupta", email: "neha@dps.edu.in", phone: "9876543224", department: "Chemistry", designation: "Teacher", status: "on_leave" },
];

export default function TeachersPage() {
  const [search, setSearch] = useState("");
  const filtered = teachers.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.employee_id.includes(search));
  return (
    <div className="space-y-6">
      <Card><CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>All Teachers</CardTitle><p className="text-sm text-gray-500 mt-1">{filtered.length} teachers</p></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" /></div>
      </CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-100 bg-gray-50/50">
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
      </tr></thead><tbody className="divide-y divide-gray-50">{filtered.map((t) => (
        <tr key={t.id} className="group hover:bg-gray-50/80 transition-colors">
          <td className="px-6 py-4"><div className="flex items-center gap-3"><Avatar name={t.name} size="sm" /><span className="text-sm font-medium text-gray-900">{t.name}</span></div></td>
          <td className="px-6 py-4 text-sm font-mono text-gray-500">{t.employee_id}</td>
          <td className="px-6 py-4 text-sm text-gray-600">{t.department}</td>
          <td className="px-6 py-4 text-sm text-gray-600">{t.designation}</td>
          <td className="px-6 py-4"><p className="text-sm text-gray-600">{t.email}</p><p className="text-xs text-gray-400">{t.phone}</p></td>
          <td className="px-6 py-4"><Badge variant={t.status === "active" ? "success" : "warning"}>{t.status}</Badge></td>
          <td className="px-6 py-4 text-right"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
          </div></td>
        </tr>
      ))}</tbody></table></div></CardContent></Card>
    </div>
  );
}
