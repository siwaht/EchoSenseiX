import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, Filter, Download, Eye, RefreshCw, CheckCircle, 
  XCircle, Clock, DollarSign, CreditCard, Calendar,
  FileText, Send, AlertTriangle
} from "lucide-react";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Payment {
  id: string;
  organizationId: string;
  organizationName?: string;
  packageId?: string;
  amount: string;
  currency?: string;
  status: "pending" | "completed" | "failed" | "refunded";
  paymentMethod?: string;
  transactionId?: string;
  description?: string;
  completedAt?: string;
  failedAt?: string;
  createdAt: string;
}

interface PaymentHistoryProps {
  transactions: Payment[];
  organizations: any[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function PaymentHistory({ transactions, organizations, onRefresh, isLoading }: PaymentHistoryProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState<Payment | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Add organization names to transactions
  const enrichedTransactions = transactions.map(t => ({
    ...t,
    organizationName: organizations.find(o => o.id === t.organizationId)?.name || "Unknown"
  }));
  
  // Filter transactions
  const filteredTransactions = enrichedTransactions.filter(t => {
    const matchesSearch = 
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transactionId?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesMethod = methodFilter === "all" || t.paymentMethod === methodFilter;
    
    let matchesDate = true;
    if (dateFilter !== "all") {
      const date = new Date(t.createdAt);
      const now = new Date();
      switch(dateFilter) {
        case "today":
          matchesDate = format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
          break;
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = date >= weekAgo;
          break;
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = date >= monthAgo;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesMethod && matchesDate;
  });
  
  // Get unique payment methods
  const paymentMethods = Array.from(new Set(transactions.map(t => t.paymentMethod).filter(Boolean)));
  
  const getStatusBadge = (status: string) => {
    switch(status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "refunded":
        return <Badge className="bg-purple-100 text-purple-800"><RefreshCw className="w-3 h-3 mr-1" />Refunded</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  const handleSelectAll = () => {
    if (selectedTransactions.length === filteredTransactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(filteredTransactions.map(t => t.id));
    }
  };
  
  const handleSelectTransaction = (id: string) => {
    if (selectedTransactions.includes(id)) {
      setSelectedTransactions(selectedTransactions.filter(t => t !== id));
    } else {
      setSelectedTransactions([...selectedTransactions, id]);
    }
  };
  
  const exportTransactions = () => {
    const dataToExport = selectedTransactions.length > 0 
      ? filteredTransactions.filter(t => selectedTransactions.includes(t.id))
      : filteredTransactions;
      
    const csvContent = [
      ['Transaction ID', 'Date', 'Organization', 'Amount', 'Status', 'Method', 'External ID', 'Description'],
      ...dataToExport.map(t => [
        t.id,
        format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        t.organizationName,
        `${t.currency || 'USD'} ${t.amount}`,
        t.status,
        t.paymentMethod || 'N/A',
        t.transactionId || 'N/A',
        t.description || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    
    toast({
      title: "Export successful",
      description: `Exported ${dataToExport.length} transactions`
    });
  };
  
  const handleRefund = async (payment: Payment) => {
    if (!confirm(`Are you sure you want to refund $${payment.amount} to ${payment.organizationName}?`)) {
      return;
    }
    
    setProcessing(payment.id);
    try {
      await apiRequest("POST", `/api/admin/payments/${payment.id}/refund`, {});
      toast({
        title: "Refund initiated",
        description: "The refund has been processed successfully"
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Refund failed",
        description: error.message || "Failed to process refund",
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };
  
  const handleResendInvoice = async (payment: Payment) => {
    setProcessing(payment.id);
    try {
      await apiRequest("POST", `/api/admin/payments/${payment.id}/invoice`, {});
      toast({
        title: "Invoice sent",
        description: "Invoice has been sent to the organization"
      });
    } catch (error: any) {
      toast({
        title: "Failed to send invoice",
        description: error.message || "Could not send invoice",
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };
  
  const handleBulkExport = () => {
    exportTransactions();
    setSelectedTransactions([]);
    setShowBulkActions(false);
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>View and manage all payment transactions</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={onRefresh} variant="outline" disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={exportTransactions} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by ID, organization, or transaction..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full lg:w-[150px]">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map(method => (
                  <SelectItem key={method} value={method!}>
                    {method!.charAt(0).toUpperCase() + method!.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full lg:w-[150px]">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Results summary */}
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-muted-foreground">
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </p>
            {selectedTransactions.length > 0 && (
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {selectedTransactions.length} selected
                </Badge>
                <Button size="sm" variant="outline" onClick={handleBulkExport}>
                  Export Selected
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedTransactions([])}>
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No transactions found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm || statusFilter !== "all" || methodFilter !== "all" || dateFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Payment transactions will appear here"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTransactions.length === filteredTransactions.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTransactions.includes(payment.id)}
                          onCheckedChange={() => handleSelectTransaction(payment.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(payment.createdAt), 'MMM dd, yyyy')}
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(payment.createdAt), 'HH:mm:ss')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{payment.organizationName}</div>
                        <div className="text-xs text-muted-foreground">
                          {payment.organizationId.slice(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">
                          ${parseFloat(payment.amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase">
                          {payment.currency || 'USD'}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        {payment.paymentMethod ? (
                          <Badge variant="outline">
                            <CreditCard className="w-3 h-3 mr-1" />
                            {payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {payment.transactionId ? (
                          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                            {payment.transactionId.slice(0, 12)}...
                          </code>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowDetails(payment)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {payment.status === "completed" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleResendInvoice(payment)}
                                disabled={processing === payment.id}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRefund(payment)}
                                disabled={processing === payment.id}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Transaction Details Dialog */}
      {showDetails && (
        <Dialog open={true} onOpenChange={() => setShowDetails(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
              <DialogDescription>
                Complete information about this payment transaction
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Transaction ID</Label>
                  <p className="font-mono text-sm">{showDetails.id}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">External ID</Label>
                  <p className="font-mono text-sm">{showDetails.transactionId || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Organization</Label>
                  <p className="text-sm">{showDetails.organizationName}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Amount</Label>
                  <p className="text-lg font-semibold">
                    {showDetails.currency || 'USD'} ${parseFloat(showDetails.amount).toFixed(2)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(showDetails.status)}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Payment Method</Label>
                  <p className="text-sm">{showDetails.paymentMethod || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Created</Label>
                  <p className="text-sm">
                    {format(new Date(showDetails.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Completed</Label>
                  <p className="text-sm">
                    {showDetails.completedAt 
                      ? format(new Date(showDetails.completedAt), 'MMM dd, yyyy HH:mm:ss')
                      : 'N/A'}
                  </p>
                </div>
              </div>
              {showDetails.description && (
                <div>
                  <Label className="text-sm text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1">{showDetails.description}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetails(null)}>
                Close
              </Button>
              {showDetails.status === "completed" && (
                <>
                  <Button variant="outline" onClick={() => handleResendInvoice(showDetails)}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Invoice
                  </Button>
                  <Button variant="destructive" onClick={() => handleRefund(showDetails)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refund
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Add missing imports
import { Label } from "@/components/ui/label";