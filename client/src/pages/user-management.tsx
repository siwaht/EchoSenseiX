import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Clock, 
  Activity, 
  Settings, 
  RefreshCw, 
  Search, 
  MoreVertical,
  Edit,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  UserX,
  SendHorizontal,
  Copy,
  ExternalLink,
  Bot,
  Download,
  Upload,
  Building2,
  Store,
  CheckSquare,
  Square,
  MailOpen,
  Power,
  Ban
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { AgentAssignment } from "@/components/admin/agent-assignment";
import { PermissionTemplatesSelector, availablePermissions, permissionPresets, roleTemplatesByOrgType } from "@/components/admin/permission-templates";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationName?: string;
  role: "admin" | "manager" | "member" | "viewer" | "agency" | "user";
  status: "active" | "inactive" | "pending";
  isAdmin: boolean;
  permissions?: string[];
  lastLogin?: string;
  createdAt: string;
  invitedBy?: string;
}


interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}


export function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("manager");
  const [selectedOrgType, setSelectedOrgType] = useState<"platform_owner" | "agency" | "end_customer">("end_customer");
  const [pendingAgentAssignments, setPendingAgentAssignments] = useState<string[]>([]);
  const [originalAgentAssignments, setOriginalAgentAssignments] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Fetch users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });


  // Fetch activity logs
  const { data: activityLogs = [], isLoading: isLoadingLogs } = useQuery<ActivityLog[]>({
    queryKey: ["/api/users/activity-logs"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: { 
      email: string; 
      password: string;
      firstName: string;
      lastName: string;
      permissions: string[];
    }) => {
      return apiRequest("POST", "/api/users/create", data);
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "New user has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowAddUserDialog(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserFirstName("");
      setNewUserLastName("");
      setSelectedPermissions([]);
    },
    onError: (error: Error) => {
      toast({
        title: "User creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; updates: Partial<User> & { permissions?: string[] } }) => {
      return apiRequest("PATCH", `/api/users/${data.userId}`, data.updates);
    },
    onSuccess: (_, variables) => {
      toast({
        title: "User updated",
        description: "User details have been updated successfully",
      });
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${variables.userId}/agents`] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowEditDialog(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "User has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle user status mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'active' | 'inactive' | 'pending' }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/status`, { status });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Status updated",
        description: `User has been ${variables.status === 'active' ? 'activated' : variables.status === 'inactive' ? 'deactivated' : 'set to pending'}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Status update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Agent assignment mutations
  const assignAgentMutation = useMutation({
    mutationFn: async ({ userId, agentId }: { userId: string; agentId: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/agents/${agentId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to assign agent");
      return response.json();
    },
  });

  const unassignAgentMutation = useMutation({
    mutationFn: async ({ userId, agentId }: { userId: string; agentId: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/agents/${agentId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to unassign agent");
      return response.json();
    },
  });

  // Get assigned agents for current user being edited
  const { data: userAgents = [] } = useQuery({
    queryKey: [`/api/admin/users/${selectedUser?.id}/agents`],
    enabled: !!selectedUser?.id && showEditDialog,
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${selectedUser?.id}/agents`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch user agents');
      const agents = await response.json();
      // Initialize pending assignments when data loads
      const assignedIds = agents.filter((a: any) => a.assigned).map((a: any) => a.id);
      setPendingAgentAssignments(assignedIds);
      setOriginalAgentAssignments(assignedIds);
      return agents;
    },
  });


  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesStatus = filterStatus === "all" || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "inactive":
        return <XCircle className="h-4 w-4 text-gray-400" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };


  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage team members, roles, and permissions
          </p>
        </div>
        <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with specific permissions
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={newUserFirstName}
                    onChange={(e) => setNewUserFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={newUserLastName}
                    onChange={(e) => setNewUserLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter a secure password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              
              {/* Organization Type Selection */}
              <div className="space-y-2">
                <Label>Organization Type</Label>
                <Select value={selectedOrgType} onValueChange={(value) => {
                  const orgType = value as "platform_owner" | "agency" | "end_customer";
                  setSelectedOrgType(orgType);
                  // Reset role when org type changes
                  const templates = roleTemplatesByOrgType[orgType];
                  let defaultRole: string;
                  
                  // Get the first available role for this org type
                  if (orgType === "platform_owner") {
                    defaultRole = "support"; // Default to support for platform
                  } else if (orgType === "agency") {
                    defaultRole = "manager"; // Default to manager for agency
                  } else {
                    defaultRole = "user"; // Default to user for customers
                  }
                  
                  setSelectedRole(defaultRole);
                  const template = templates[defaultRole as keyof typeof templates];
                  if (template) {
                    setSelectedPermissions(template.permissions);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="end_customer">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4" />
                        <span>Customer Organization</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="agency">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <span>Agency (Reseller)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="platform_owner">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span>Platform Admin</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Permission Templates */}
              <PermissionTemplatesSelector
                selectedPermissions={selectedPermissions}
                onPermissionsChange={setSelectedPermissions}
                organizationType={selectedOrgType}
                selectedRole={selectedRole}
                onRoleChange={setSelectedRole}
                showCustomization={true}
              />
              
              {/* Permissions Checkboxes */}
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="border rounded-lg p-4 space-y-4">
                  {["Core Access", "Agent Management", "Communications", "Administration"].map(category => {
                    const categoryPermissions = availablePermissions.filter(p => p.category === category);
                    if (categoryPermissions.length === 0) return null;
                    return (
                      <div key={category} className="space-y-2">
                        <div className="font-medium text-sm text-muted-foreground">{category}</div>
                        <div className="space-y-2">
                          {categoryPermissions.map(permission => (
                            <div key={permission.id} className="flex items-start space-x-2">
                              <input
                                type="checkbox"
                                id={permission.id}
                                checked={selectedPermissions.includes(permission.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPermissions([...selectedPermissions, permission.id]);
                                  } else {
                                    setSelectedPermissions(selectedPermissions.filter(p => p !== permission.id));
                                  }
                                }}
                                className="rounded border-gray-300 mt-0.5"
                              />
                              <div className="flex-1">
                                <Label htmlFor={permission.id} className="text-sm font-normal cursor-pointer">
                                  {permission.label}
                                </Label>
                                {permission.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{permission.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Selected permissions: {selectedPermissions.length} of {availablePermissions.length}
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddUserDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={() => {
                  if (!newUserEmail || !newUserPassword) {
                    toast({
                      title: "Missing required fields",
                      description: "Please enter email and password",
                      variant: "destructive",
                    });
                    return;
                  }
                  createUserMutation.mutate({
                    email: newUserEmail,
                    password: newUserPassword,
                    firstName: newUserFirstName,
                    lastName: newUserLastName,
                    permissions: selectedPermissions,
                  });
                }}
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              Active members in organization
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Permissions</CardTitle>
            <Key className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.permissions && u.permissions.length > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Users with custom permissions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrators</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === "admin").length}
            </div>
            <p className="text-xs text-muted-foreground">
              With full access
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Search and Filter */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {Object.entries(permissionPresets).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>{preset.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Bulk Actions Bar */}
          {showBulkActions && (
            <Card className="border-primary">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{selectedUsers.size} users selected</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUsers(new Set());
                        setShowBulkActions(false);
                      }}
                    >
                      Clear selection
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <UserCheck className="h-4 w-4 mr-2" />
                      Activate
                    </Button>
                    <Button variant="outline" size="sm">
                      <UserX className="h-4 w-4 mr-2" />
                      Deactivate
                    </Button>
                    <Button variant="outline" size="sm">
                      <MailOpen className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage user roles and permissions for your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex justify-center items-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No users found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery || filterRole !== "all" || filterStatus !== "all"
                      ? "Try adjusting your search or filter criteria"
                      : "Add team members to get started"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
                                setShowBulkActions(true);
                              } else {
                                setSelectedUsers(new Set());
                                setShowBulkActions(false);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id} className={selectedUsers.has(user.id) ? "bg-muted/50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selectedUsers.has(user.id)}
                              onCheckedChange={(checked) => {
                                const newSelection = new Set(selectedUsers);
                                if (checked) {
                                  newSelection.add(user.id);
                                } else {
                                  newSelection.delete(user.id);
                                }
                                setSelectedUsers(newSelection);
                                setShowBulkActions(newSelection.size > 0);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium">
                                  {user.firstName[0]}{user.lastName[0]}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium">
                                  {user.firstName} {user.lastName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === "admin" ? "destructive" : "secondary"}>
                              <Shield className="mr-1 h-3 w-3" />
                              {user.permissions?.length ? `${user.permissions.length} permissions` : "No permissions"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(user.status)}
                              <span className="text-sm capitalize">{user.status}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {user.lastLogin 
                                ? formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true })
                                : "Never"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setEditPassword("");
                                    setEditPermissions(user.permissions || []);
                                    setShowEditDialog(true);
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    const newStatus = user.status === 'active' ? 'inactive' : 'active';
                                    toggleUserStatusMutation.mutate({ userId: user.id, status: newStatus });
                                  }}
                                >
                                  {user.status === 'active' ? (
                                    <>
                                      <Ban className="mr-2 h-4 w-4 text-orange-500" />
                                      Deactivate User
                                    </>
                                  ) : (
                                    <>
                                      <Power className="mr-2 h-4 w-4 text-green-500" />
                                      Activate User
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to permanently delete ${user.email}? This action cannot be undone.`)) {
                                      deleteUserMutation.mutate(user.id);
                                    }
                                  }}
                                  disabled={user.id === (currentUser as any)?.id}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
              <CardDescription>
                Track user actions and system events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="flex justify-center items-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No activity logs</h3>
                  <p className="text-muted-foreground">
                    Activity will appear here as users interact with the system
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activityLogs.slice(0, 20).map((log) => (
                    <div key={log.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div className="flex-1">
                        <div className="text-sm">
                          <span className="font-medium">{log.userEmail}</span>
                          <span className="text-muted-foreground"> {log.action}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.details} • {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          {log.ipAddress && ` • IP: ${log.ipAddress}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      {selectedUser && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user details and permissions
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={selectedUser.email} disabled />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-password">Reset Password</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a new password to reset the user's password. Leave blank to keep the current password.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={selectedUser.status} 
                  onValueChange={(value) => setSelectedUser({...selectedUser, status: value as any})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Active
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-gray-400" />
                        Inactive
                      </div>
                    </SelectItem>
                    <SelectItem value="pending">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        Pending
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={selectedUser.firstName}
                    onChange={(e) => setSelectedUser({...selectedUser, firstName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={selectedUser.lastName}
                    onChange={(e) => setSelectedUser({...selectedUser, lastName: e.target.value})}
                  />
                </div>
              </div>
              {/* Permission Templates for Edit */}
              <PermissionTemplatesSelector
                selectedPermissions={editPermissions}
                onPermissionsChange={setEditPermissions}
                userType={selectedUser.role === 'agency' ? 'agency' : 'regular'}
                showCustomization={true}
              />
              
              {/* Permission Quick Templates */}
              <div className="space-y-2">
                <Label>Quick Templates</Label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(permissionPresets).map(([key, preset]) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditPermissions(preset.permissions);
                        setSelectedUser({...selectedUser, role: key as any});
                      }}
                      className="text-xs"
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditPermissions([])}
                    className="text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              {/* Permissions Checkboxes */}
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="border rounded-lg p-4 space-y-4">
                  {["Core Access", "Agent Management", "Communications", "Administration"].map(category => {
                    const categoryPermissions = availablePermissions.filter(p => p.category === category);
                    if (categoryPermissions.length === 0) return null;
                    return (
                      <div key={category} className="space-y-2">
                        <div className="font-medium text-sm text-muted-foreground">{category}</div>
                        <div className="space-y-2">
                          {categoryPermissions.map(permission => (
                            <div key={permission.id} className="flex items-start space-x-2">
                              <input
                                type="checkbox"
                                id={`edit-${permission.id}`}
                                checked={editPermissions.includes(permission.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditPermissions([...editPermissions, permission.id]);
                                  } else {
                                    setEditPermissions(editPermissions.filter(p => p !== permission.id));
                                  }
                                }}
                                className="rounded border-gray-300 mt-0.5"
                              />
                              <div className="flex-1">
                                <Label htmlFor={`edit-${permission.id}`} className="text-sm font-normal cursor-pointer">
                                  {permission.label}
                                </Label>
                                {permission.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{permission.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Selected permissions: {editPermissions.length} of {availablePermissions.length}
              </div>
              
              {/* Agent Assignments Section */}
              {!selectedUser.isAdmin && (
                <div className="mt-6">
                  <AgentAssignment 
                    key={selectedUser.id} 
                    userId={selectedUser.id}
                    hideActions={true}  // Hide internal save buttons since dialog has its own
                    onAssignmentsChange={(assignments) => setPendingAgentAssignments(assignments)}
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={selectedUser.status} 
                  onValueChange={(value) => setSelectedUser({...selectedUser, status: value as any})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>New Password (optional)</Label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const updates: any = {
                    firstName: selectedUser.firstName,
                    lastName: selectedUser.lastName,
                    role: selectedUser.role,
                    status: selectedUser.status,
                    permissions: editPermissions,
                  };
                  if (editPassword) {
                    updates.password = editPassword;
                  }
                  
                  try {
                    // Save user details first
                    await updateUserMutation.mutateAsync({
                      userId: selectedUser.id,
                      updates
                    });
                    
                    // Handle agent assignments
                    const toAssign = pendingAgentAssignments.filter(id => !originalAgentAssignments.includes(id));
                    const toUnassign = originalAgentAssignments.filter(id => !pendingAgentAssignments.includes(id));
                    
                    // Process assignments
                    for (const agentId of toAssign) {
                      await assignAgentMutation.mutateAsync({ userId: selectedUser.id, agentId });
                    }
                    
                    // Process unassignments
                    for (const agentId of toUnassign) {
                      await unassignAgentMutation.mutateAsync({ userId: selectedUser.id, agentId });
                    }
                    
                    // Invalidate related queries
                    await queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${selectedUser.id}/agents`] });
                    await queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
                  } catch (error) {
                    console.error('Error saving user changes:', error);
                  }
                }}
                disabled={updateUserMutation.isPending || assignAgentMutation.isPending || unassignAgentMutation.isPending}
              >
                {(updateUserMutation.isPending || assignAgentMutation.isPending || unassignAgentMutation.isPending) ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}