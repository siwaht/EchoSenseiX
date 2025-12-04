import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  UserPlus,
  Mail,
  Users,
  Bot,
  Trash2,
  Edit,
  Send,
  X
} from "lucide-react";
import { useLocation } from "wouter";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "manager" | "user";
  status: "active" | "inactive" | "pending";
  createdAt: string;
  lastLoginAt?: string;
  permissions: string[];
  assignedAgentIds?: string[];
}

interface Agent {
  id: string;
  name: string;
  elevenLabsAgentId: string;
  isActive: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: "admin" | "manager" | "user";
  status: "pending" | "accepted" | "expired";
  invitedAt: string;
  expiresAt: string;
  permissions: string[];
}

const availablePermissions = [
  { id: "view_dashboard", name: "View Dashboard", description: "Access to main dashboard" },
  { id: "manage_agents", name: "Manage Agents", description: "Create, edit, and delete agents" },
  { id: "view_agents", name: "View Agents", description: "View agent list and details" },
  { id: "manage_voices", name: "Manage Voices", description: "Configure voice settings" },
  { id: "manage_phone_numbers", name: "Manage Phone Numbers", description: "Add and configure phone numbers" },
  { id: "make_outbound_calls", name: "Make Outbound Calls", description: "Initiate outbound calling campaigns" },
  { id: "view_call_history", name: "View Call History", description: "Access call logs and recordings" },
  { id: "manage_integrations", name: "Manage Integrations", description: "Configure third-party integrations" },
  { id: "view_billing", name: "View Billing", description: "Access billing and usage information" },
  { id: "configure_tools", name: "Configure Tools", description: "Set up and manage agent tools" },
];

const rolePermissions = {
  admin: availablePermissions.map(p => p.id),
  manager: [
    "view_dashboard",
    "view_agents",
    "manage_voices",
    "manage_phone_numbers",
    "make_outbound_calls",
    "view_call_history",
    "view_billing",
    "configure_tools"
  ],
  user: [
    "view_dashboard",
    "view_agents",
    "view_call_history"
  ]
};

export default function AgencyUsers() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [assignAgentsDialogOpen, setAssignAgentsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states for direct user creation
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createRole, setCreateRole] = useState<"admin" | "manager" | "user">("user");
  const [createPermissions, setCreatePermissions] = useState<string[]>([]);

  // Form states for invitations
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "user">("user");
  const [invitePermissions, setInvitePermissions] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // Fetch users in organization
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/agency/users"],
  });

  // Fetch invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/agency/invitations"],
  });

  // Fetch agents for assignment
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch organization data for plan limits
  const { data: orgData } = useQuery<any>({
    queryKey: ["/api/organization/current"],
  });

  // Create user directly mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      firstName: string;
      lastName: string;
      password: string;
      role: string;
      permissions: string[]
    }) => {
      const response = await apiRequest("POST", "/api/agency/users", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "User created",
        description: `User has been created successfully. (${data.currentUsers}/${data.maxUsers} users)`,
      });
      setCreateUserDialogOpen(false);
      setCreateEmail("");
      setCreatePassword("");
      setCreateFirstName("");
      setCreateLastName("");
      setCreateRole("user");
      setCreatePermissions([]);
      queryClient.invalidateQueries({ queryKey: ["/api/agency/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organization/current"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create user",
        description: error.message || "Could not create user",
        variant: "destructive",
      });
    },
  });

  // Send invitation mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string; permissions: string[] }) => {
      return apiRequest("POST", "/api/agency/users/invite", data);
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: "User invitation has been sent successfully",
      });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("user");
      setInvitePermissions([]);
      queryClient.invalidateQueries({ queryKey: ["/api/agency/invitations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
        description: error.message || "Could not send user invitation",
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; updates: Partial<User> }) => {
      return apiRequest("PATCH", `/api/agency/users/${data.userId}`, data.updates);
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "User settings have been updated successfully",
      });
      setEditUserDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/agency/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update user",
        description: error.message || "Could not update user settings",
        variant: "destructive",
      });
    },
  });

  // Assign agents mutation
  const assignAgentsMutation = useMutation({
    mutationFn: async (data: { userId: string; agentIds: string[] }) => {
      return apiRequest("POST", `/api/agency/users/${data.userId}/agents`, { agentIds: data.agentIds });
    },
    onSuccess: () => {
      toast({
        title: "Agents assigned",
        description: "Agents have been assigned to the user successfully",
      });
      setAssignAgentsDialogOpen(false);
      setSelectedAgents([]);
      queryClient.invalidateQueries({ queryKey: ["/api/agency/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign agents",
        description: error.message || "Could not assign agents to user",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/agency/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "User removed",
        description: "User has been removed from your organization",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove user",
        description: error.message || "Could not remove user",
        variant: "destructive",
      });
    },
  });

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest("POST", `/api/agency/invitations/${invitationId}/resend`);
    },
    onSuccess: () => {
      toast({
        title: "Invitation resent",
        description: "Invitation has been resent successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/invitations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to resend invitation",
        description: error.message || "Could not resend invitation",
        variant: "destructive",
      });
    },
  });

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest("DELETE", `/api/agency/invitations/${invitationId}`);
    },
    onSuccess: () => {
      toast({
        title: "Invitation cancelled",
        description: "Invitation has been cancelled",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/invitations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel invitation",
        description: error.message || "Could not cancel invitation",
        variant: "destructive",
      });
    },
  });

  const handleInviteUser = () => {
    if (!inviteEmail || !inviteRole) {
      toast({
        title: "Missing information",
        description: "Please provide email and role",
        variant: "destructive",
      });
      return;
    }

    const permissions = invitePermissions.length > 0 ? invitePermissions : rolePermissions[inviteRole];
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole, permissions });
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditUserDialogOpen(true);
  };

  const handleAssignAgents = (user: User) => {
    setSelectedUser(user);
    setSelectedAgents(user.assignedAgentIds || []);
    setAssignAgentsDialogOpen(true);
  };

  const handleSaveAgentAssignment = () => {
    if (selectedUser) {
      assignAgentsMutation.mutate({ userId: selectedUser.id, agentIds: selectedAgents });
    }
  };

  const handleCreateUser = () => {
    if (!createEmail || !createPassword || !createFirstName || !createLastName) {
      toast({
        title: "Missing information",
        description: "Please provide all required fields",
        variant: "destructive",
      });
      return;
    }

    const permissions = createPermissions.length > 0 ? createPermissions : rolePermissions[createRole];
    createUserMutation.mutate({
      email: createEmail,
      firstName: createFirstName,
      lastName: createLastName,
      password: createPassword,
      role: createRole,
      permissions
    });
  };

  const handleCreateRoleChange = (role: "admin" | "manager" | "user") => {
    setCreateRole(role);
    setCreatePermissions(rolePermissions[role]);
  };

  const handleRoleChange = (role: "admin" | "manager" | "user") => {
    setInviteRole(role);
    setInvitePermissions(rolePermissions[role]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "inactive":
        return "bg-gray-500";
      case "expired":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      case "user":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (usersLoading || invitationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your organization's users and permissions
          </p>
          {orgData && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={users.length >= (orgData.maxUsers || 10) ? "destructive" : "secondary"}>
                {users.length} / {orgData.maxUsers || 10} Users
              </Badge>
              <span className="text-sm text-muted-foreground">
                {users.length >= (orgData.maxUsers || 10) ? "User limit reached" : `${(orgData.maxUsers || 10) - users.length} seats available`}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation("/whitelabel-settings")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={orgData && users.length >= (orgData.maxUsers || 10)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account for your organization
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-1 py-4">
                <div className="space-y-4 pr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-firstName">First Name</Label>
                      <Input
                        id="create-firstName"
                        placeholder="John"
                        value={createFirstName}
                        onChange={(e) => setCreateFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-lastName">Last Name</Label>
                      <Input
                        id="create-lastName"
                        placeholder="Doe"
                        value={createLastName}
                        onChange={(e) => setCreateLastName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-email">Email Address</Label>
                    <Input
                      id="create-email"
                      type="email"
                      placeholder="user@example.com"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-password">Password</Label>
                    <Input
                      id="create-password"
                      type="password"
                      placeholder="Enter a secure password"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      User will be able to change this password after first login
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-role">Role</Label>
                    <Select value={createRole} onValueChange={handleCreateRoleChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {user?.role === "agency" ? (
                          <SelectItem value="user">User - Limited access</SelectItem>
                        ) : (
                          <>
                            <SelectItem value="admin">Admin - Full access</SelectItem>
                            <SelectItem value="manager">Manager - Moderate access</SelectItem>
                            <SelectItem value="user">User - Limited access</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {availablePermissions.map((permission) => (
                          <div key={permission.id} className="flex items-start space-x-2">
                            <Checkbox
                              id={`create-${permission.id}`}
                              checked={createPermissions.includes(permission.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCreatePermissions([...createPermissions, permission.id]);
                                } else {
                                  setCreatePermissions(createPermissions.filter(p => p !== permission.id));
                                }
                              }}
                            />
                            <div className="flex-1">
                              <Label htmlFor={`create-${permission.id}`} className="text-sm font-medium cursor-pointer">
                                {permission.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-shrink-0">
                <Button variant="outline" onClick={() => setCreateUserDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Send an invitation to add a new user to your organization
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-1 py-4">
                <div className="space-y-4 pr-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={handleRoleChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {user?.role === "agency" ? (
                          <SelectItem value="user">User - Limited access</SelectItem>
                        ) : (
                          <>
                            <SelectItem value="admin">Admin - Full access</SelectItem>
                            <SelectItem value="manager">Manager - Moderate access</SelectItem>
                            <SelectItem value="user">User - Limited access</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {availablePermissions.map((permission) => (
                          <div key={permission.id} className="flex items-start space-x-2">
                            <Checkbox
                              id={permission.id}
                              checked={invitePermissions.includes(permission.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setInvitePermissions([...invitePermissions, permission.id]);
                                } else {
                                  setInvitePermissions(invitePermissions.filter(p => p !== permission.id));
                                }
                              }}
                            />
                            <div className="flex-1">
                              <Label htmlFor={permission.id} className="text-sm font-medium cursor-pointer">
                                {permission.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-shrink-0">
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInviteUser} disabled={inviteMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            Active Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Mail className="h-4 w-4 mr-2" />
            Invitations ({invitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Users</CardTitle>
              <CardDescription>
                Manage users, roles, and agent assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Agents</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(user.status)}`} />
                          <span className="text-sm capitalize">{user.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignAgents(user)}
                        >
                          <Bot className="h-4 w-4 mr-1" />
                          {user.assignedAgentIds?.length || 0} Agents
                        </Button>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleDateString()
                            : "Never"
                          }
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to remove this user?")) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                View and manage user invitations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No pending invitations
                      </TableCell>
                    </TableRow>
                  ) : (
                    invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(invitation.role)}>
                            {invitation.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={invitation.status === "pending" ? "outline" : "secondary"}>
                            {invitation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.invitedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.expiresAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resendInvitationMutation.mutate(invitation.id)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Are you sure you want to cancel this invitation?")) {
                                  cancelInvitationMutation.mutate(invitation.id);
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and permissions
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <div className="font-medium">
                  {selectedUser.firstName} {selectedUser.lastName}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="text-sm text-muted-foreground">
                  {selectedUser.email}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={selectedUser.role}
                  onValueChange={(value: "admin" | "manager" | "user") => {
                    updateUserMutation.mutate({
                      userId: selectedUser.id,
                      updates: { role: value }
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Agents Dialog */}
      <Dialog open={assignAgentsDialogOpen} onOpenChange={setAssignAgentsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Agents</DialogTitle>
            <DialogDescription>
              Select which agents this user can access
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded">
                  <Checkbox
                    id={`agent-${agent.id}`}
                    checked={selectedAgents.includes(agent.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedAgents([...selectedAgents, agent.id]);
                      } else {
                        setSelectedAgents(selectedAgents.filter(id => id !== agent.id));
                      }
                    }}
                  />
                  <Label htmlFor={`agent-${agent.id}`} className="flex-1 cursor-pointer">
                    {agent.name}
                  </Label>
                </div>
              ))}
              {agents.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No agents available
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignAgentsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAgentAssignment} disabled={assignAgentsMutation.isPending}>
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}