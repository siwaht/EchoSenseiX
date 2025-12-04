import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload, Download, Mail,
  Trash2, Edit, AlertTriangle,
  FileSpreadsheet, Save, Send, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from 'date-fns';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role?: string;
  status?: string;
  permissions?: string[];
  createdAt: string;
}

interface UserBulkOperationsProps {
  users: User[];
  selectedUsers: string[];
  onRefresh: () => void;
  onUsersUpdated: () => void;
}

export function UserBulkOperations({
  users,
  selectedUsers,

  onUsersUpdated
}: UserBulkOperationsProps) {
  const { toast } = useToast();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false);
  const [importData, setImportData] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");

  const [bulkEditData, setBulkEditData] = useState({
    role: "",
    status: "",
    permissions: [] as string[],
    addPermissions: [] as string[],
    removePermissions: [] as string[],
    action: "replace" as "replace" | "add" | "remove"
  });

  const availablePermissions = [
    { id: "view_analytics", label: "View Dashboard & Analytics" },
    { id: "view_call_history", label: "View Call History" },
    { id: "manage_agents", label: "Manage Agents" },
    { id: "configure_tools", label: "Configure Agent Tools" },
    { id: "access_playground", label: "Test Agents" },
    { id: "manage_voices", label: "Manage Voices" },
    { id: "manage_phone_numbers", label: "Manage Phone Numbers" },
    { id: "make_outbound_calls", label: "Outbound Calling" },
    { id: "access_recordings", label: "Access Recordings" },
    { id: "manage_integrations", label: "Manage Integrations" },
    { id: "view_billing", label: "View Billing" },
    { id: "manage_settings", label: "Manage Settings" },
    { id: "manage_users", label: "Manage Users" }
  ];

  // Export users
  const exportUsers = () => {
    const dataToExport = selectedUsers.length > 0
      ? users.filter(u => selectedUsers.includes(u.id))
      : users;

    const csvContent = [
      ['ID', 'Email', 'First Name', 'Last Name', 'Role', 'Status', 'Permissions', 'Created Date'],
      ...dataToExport.map(user => [
        user.id,
        user.email,
        user.firstName,
        user.lastName,
        user.role || 'user',
        user.status || 'active',
        user.permissions?.join(';') || '',
        format(new Date(user.createdAt), 'yyyy-MM-dd')
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();

    toast({
      title: "Export successful",
      description: `Exported ${dataToExport.length} users`
    });
  };

  // Parse CSV for import
  const parseCSV = (csv: string) => {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    const headers = lines[0]!.split(',').map(h => h.trim().replace(/"/g, ''));

    return lines.slice(1).map(line => {
      const values = line.match(/(".*?"|[^,]+)/g) || [];
      const user: any = {};

      headers.forEach((header, index) => {
        let value = values[index] ? values[index].trim().replace(/"/g, '') : '';

        // Map CSV headers to user fields
        switch (header.toLowerCase()) {
          case 'email':
            user.email = value;
            break;
          case 'first name':
          case 'firstname':
            user.firstName = value;
            break;
          case 'last name':
          case 'lastname':
            user.lastName = value;
            break;
          case 'role':
            user.role = value;
            break;
          case 'status':
            user.status = value;
            break;
          case 'permissions':
            user.permissions = value ? value.split(';').filter(Boolean) : [];
            break;
          case 'password':
            user.password = value;
            break;
        }
      });

      return user;
    }).filter(u => u.email); // Only include users with email
  };

  // Import users
  const handleImport = async () => {
    try {
      setIsProcessing(true);
      const usersToImport = parseCSV(importData);

      if (usersToImport.length === 0) {
        toast({
          title: "Import failed",
          description: "No valid users found in CSV",
          variant: "destructive"
        });
        return;
      }

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < usersToImport.length; i++) {
        setImportProgress((i / usersToImport.length) * 100);

        try {
          await apiRequest("POST", "/api/users/create", usersToImport[i]);
          successCount++;
        } catch (error) {
          failedCount++;
          console.error(`Failed to import user ${usersToImport[i].email}:`, error);
        }
      }

      setImportProgress(100);

      toast({
        title: "Import completed",
        description: `Successfully imported ${successCount} users${failedCount > 0 ? `, ${failedCount} failed` : ''}`
      });

      onUsersUpdated();
      setShowImportDialog(false);
      setImportData("");
      setImportProgress(0);
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import users",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk edit users
  const handleBulkEdit = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "No users selected",
        description: "Please select users to edit",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      const updates: any = {};

      if (bulkEditData.role) updates.role = bulkEditData.role;
      if (bulkEditData.status) updates.status = bulkEditData.status;

      // Handle permissions based on action
      if (bulkEditData.action === "replace" && bulkEditData.permissions.length > 0) {
        updates.permissions = bulkEditData.permissions;
      }

      let successCount = 0;
      let failedCount = 0;

      for (const userId of selectedUsers) {
        try {
          // Get current user if we need to add/remove permissions
          let finalUpdates = { ...updates };

          if (bulkEditData.action === "add" || bulkEditData.action === "remove") {
            const user = users.find(u => u.id === userId);
            if (user) {
              const currentPermissions = user.permissions || [];

              if (bulkEditData.action === "add") {
                finalUpdates.permissions = Array.from(
                  new Set([...currentPermissions, ...bulkEditData.addPermissions])
                );
              } else if (bulkEditData.action === "remove") {
                finalUpdates.permissions = currentPermissions.filter(
                  p => !bulkEditData.removePermissions.includes(p)
                );
              }
            }
          }

          await apiRequest("PATCH", `/api/users/${userId}`, finalUpdates);
          successCount++;
        } catch (error) {
          failedCount++;
          console.error(`Failed to update user ${userId}:`, error);
        }
      }

      toast({
        title: "Bulk edit completed",
        description: `Updated ${successCount} users${failedCount > 0 ? `, ${failedCount} failed` : ''}`
      });

      onUsersUpdated();
      setShowBulkEditDialog(false);
    } catch (error: any) {
      toast({
        title: "Bulk edit failed",
        description: error.message || "Failed to update users",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk delete users
  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "No users selected",
        description: "Please select users to delete",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedUsers.length} users? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsProcessing(true);
      let successCount = 0;
      let failedCount = 0;

      for (const userId of selectedUsers) {
        try {
          await apiRequest("DELETE", `/api/users/${userId}`);
          successCount++;
        } catch (error) {
          failedCount++;
          console.error(`Failed to delete user ${userId}:`, error);
        }
      }

      toast({
        title: "Bulk delete completed",
        description: `Deleted ${successCount} users${failedCount > 0 ? `, ${failedCount} failed` : ''}`
      });

      onUsersUpdated();
    } catch (error: any) {
      toast({
        title: "Bulk delete failed",
        description: error.message || "Failed to delete users",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Send bulk email
  const handleBulkEmail = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "No users selected",
        description: "Please select users to email",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);

      const selectedUserEmails = users
        .filter(u => selectedUsers.includes(u.id))
        .map(u => u.email);

      await apiRequest("POST", "/api/users/bulk-email", {
        recipients: selectedUserEmails,
        subject: emailSubject,
        content: emailContent
      });

      toast({
        title: "Emails sent",
        description: `Successfully sent emails to ${selectedUserEmails.length} users`
      });

      setShowBulkEmailDialog(false);
      setEmailSubject("");
      setEmailContent("");
    } catch (error: any) {
      toast({
        title: "Email failed",
        description: error.message || "Failed to send emails",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateTemplate = () => {
    const template = `Email,First Name,Last Name,Role,Status,Permissions,Password
john@example.com,John,Doe,user,active,view_dashboard;view_analytics,password123
jane@example.com,Jane,Smith,admin,active,view_dashboard;manage_users;view_billing,password456`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user-import-template.csv';
    a.click();

    toast({
      title: "Template downloaded",
      description: "Use this template to import users"
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Operations</CardTitle>
          <CardDescription>
            Manage multiple users at once with bulk actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {selectedUsers.length > 0 && (
              <Badge variant="secondary" className="mb-2">
                {selectedUsers.length} users selected
              </Badge>
            )}

            <Button onClick={exportUsers} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Users
            </Button>

            <Button onClick={() => setShowImportDialog(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import Users
            </Button>

            {selectedUsers.length > 0 && (
              <>
                <Button onClick={() => setShowBulkEditDialog(true)} variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Selected
                </Button>

                <Button onClick={() => setShowBulkEmailDialog(true)} variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Selected
                </Button>

                <Button
                  onClick={handleBulkDelete}
                  variant="destructive"
                  disabled={isProcessing}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Users</DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import users
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>CSV Data</Label>
              <Textarea
                placeholder="Paste CSV data here or upload a file..."
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={generateTemplate}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <span className="text-sm text-muted-foreground">
                Use our template for the correct format
              </span>
            </div>

            {importProgress > 0 && importProgress < 100 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Importing users...</span>
                  <span>{importProgress.toFixed(0)}%</span>
                </div>
                <Progress value={importProgress} />
              </div>
            )}

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium mb-1">CSV Format Requirements:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li>First row must contain headers</li>
                    <li>Email field is required</li>
                    <li>Permissions should be semicolon-separated</li>
                    <li>Passwords will be set if provided</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importData || isProcessing}>
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Users
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Edit Users</DialogTitle>
            <DialogDescription>
              Update {selectedUsers.length} selected users
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <Select value={bulkEditData.role} onValueChange={(v) => setBulkEditData({ ...bulkEditData, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Keep current" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Keep current</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={bulkEditData.status} onValueChange={(v) => setBulkEditData({ ...bulkEditData, status: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Keep current" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Keep current</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Permission Action</Label>
              <Select
                value={bulkEditData.action}
                onValueChange={(v: "replace" | "add" | "remove") => setBulkEditData({ ...bulkEditData, action: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="replace">Replace all permissions</SelectItem>
                  <SelectItem value="add">Add permissions</SelectItem>
                  <SelectItem value="remove">Remove permissions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Permissions</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {availablePermissions.map(perm => (
                  <div key={perm.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bulk-${perm.id}`}
                      checked={
                        bulkEditData.action === "replace"
                          ? bulkEditData.permissions.includes(perm.id)
                          : bulkEditData.action === "add"
                            ? bulkEditData.addPermissions.includes(perm.id)
                            : bulkEditData.removePermissions.includes(perm.id)
                      }
                      onCheckedChange={(checked) => {
                        if (bulkEditData.action === "replace") {
                          setBulkEditData({
                            ...bulkEditData,
                            permissions: checked
                              ? [...bulkEditData.permissions, perm.id]
                              : bulkEditData.permissions.filter(p => p !== perm.id)
                          });
                        } else if (bulkEditData.action === "add") {
                          setBulkEditData({
                            ...bulkEditData,
                            addPermissions: checked
                              ? [...bulkEditData.addPermissions, perm.id]
                              : bulkEditData.addPermissions.filter(p => p !== perm.id)
                          });
                        } else {
                          setBulkEditData({
                            ...bulkEditData,
                            removePermissions: checked
                              ? [...bulkEditData.removePermissions, perm.id]
                              : bulkEditData.removePermissions.filter(p => p !== perm.id)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`bulk-${perm.id}`} className="text-sm font-normal cursor-pointer">
                      {perm.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkEdit} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Users
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Email Dialog */}
      <Dialog open={showBulkEmailDialog} onOpenChange={setShowBulkEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Bulk Email</DialogTitle>
            <DialogDescription>
              Send email to {selectedUsers.length} selected users
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Subject</Label>
              <Input
                placeholder="Email subject..."
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            <div>
              <Label>Message</Label>
              <Textarea
                placeholder="Email content..."
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                rows={10}
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p>This will send an email to all selected users.</p>
                  <p>Available variables: {"{firstName}"}, {"{lastName}"}, {"{email}"}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEmailDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkEmail}
              disabled={!emailSubject || !emailContent || isProcessing}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Emails
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}