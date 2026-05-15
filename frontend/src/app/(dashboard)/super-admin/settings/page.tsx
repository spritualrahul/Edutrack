"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Settings, Save } from "lucide-react";

export default function SuperAdminSettings() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl space-y-6">
        <Card><CardHeader><CardTitle>General Settings</CardTitle></CardHeader><CardContent className="space-y-4">
          <div><Label className="mb-2 block">Platform Name</Label><Input defaultValue="EduStack" /></div>
          <div><Label className="mb-2 block">Support Email</Label><Input defaultValue="support@edustack.in" /></div>
          <div><Label className="mb-2 block">Default Currency</Label><Input defaultValue="INR" /></div>
          <Button><Save className="h-4 w-4 mr-1.5" />Save Changes</Button>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Clerk Configuration</CardTitle></CardHeader><CardContent className="space-y-4">
          <div><Label className="mb-2 block">Publishable Key</Label><Input defaultValue="pk_test_•••••••" type="password" /></div>
          <div><Label className="mb-2 block">Secret Key</Label><Input defaultValue="sk_test_•••••••" type="password" /></div>
          <Button><Save className="h-4 w-4 mr-1.5" />Update Keys</Button>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Payment Gateway</CardTitle></CardHeader><CardContent className="space-y-4">
          <div><Label className="mb-2 block">Razorpay Key ID</Label><Input placeholder="rzp_live_xxxxx" /></div>
          <div><Label className="mb-2 block">Razorpay Secret</Label><Input placeholder="Enter secret key" type="password" /></div>
          <Button><Save className="h-4 w-4 mr-1.5" />Save</Button>
        </CardContent></Card>
      </div>
    </div>
  );
}
