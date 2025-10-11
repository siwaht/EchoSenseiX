import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Save, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PermissionTemplatesSelector } from "./permission-templates";

interface AgencyPermissionsProps {
  organizationId: string;
  organizationName: string;
  organizationType?: string;
  billingPackage?: string;
}

export function AgencyPermissions({ 
  organizationId, 
  organizationName,
  organizationType,
  billingPackage
}: AgencyPermissionsProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current permissions
  const { data: permissionData, isLoading } = useQuery<{
    organizationId: string;
    organizationName: string;
    permissions: string[];
    organizationType: string;
    billingPackage: string;
    role?: string;
  }>({
    queryKey: [`/api/admin/organizations/${organizationId}/permissions`],
    enabled: !!organizationId,
  });

  // Initialize permissions when data loads
  useEffect(() => {
    if (permissionData) {
      setSelectedPermissions(permissionData.permissions || []);
      setSelectedRole(permissionData.role || null);
    }
  }, [permissionData]);

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async (data: { permissions: string[], role?: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/organizations/${organizationId}/permissions`,
        data
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update permissions");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Permissions Updated",
        description: "Agency permissions have been updated successfully",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/organizations/${organizationId}/permissions`] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update agency permissions",
        variant: "destructive",
      });
    },
  });

  const handlePermissionsChange = (permissions: string[]) => {
    setSelectedPermissions(permissions);
    setHasChanges(true);
  };

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    setHasChanges(true);
  };

  const handleSave = () => {
    updatePermissionsMutation.mutate({ 
      permissions: selectedPermissions,
      role: selectedRole || undefined
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertDescription>
          Configure what features and capabilities <strong>{organizationName}</strong> can access in the platform.
          These permissions apply to all users within this agency organization.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Agency Permissions</CardTitle>
          <CardDescription>
            Select a permission template or customize individual permissions for this agency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PermissionTemplatesSelector
            selectedPermissions={selectedPermissions}
            onPermissionsChange={handlePermissionsChange}
            selectedRole={selectedRole || undefined}
            onRoleChange={handleRoleChange}
            userType="agency"
            organizationType="agency"
            showCustomization={true}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updatePermissionsMutation.isPending}
        >
          <Save className="w-4 h-4 mr-2" />
          {updatePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
        </Button>
      </div>
    </div>
  );
}