import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsExportProps {
  data: any;
  filename?: string;

}

export function AnalyticsExport({ data, filename = "analytics" }: AnalyticsExportProps) {
  const { toast } = useToast();

  const exportToCSV = () => {
    if (!data || data.length === 0) {
      toast({
        title: "No data to export",
        description: "There is no data available to export.",
        variant: "destructive"
      });
      return;
    }

    // Prepare CSV content
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","), // Header row
      ...data.map((row: any) =>
        headers.map(header => {
          const value = row[header];
          // Handle values that might contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(",")
      )
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `Data exported to ${filename}.csv`
    });
  };

  const exportToJSON = () => {
    if (!data || data.length === 0) {
      toast({
        title: "No data to export",
        description: "There is no data available to export.",
        variant: "destructive"
      });
      return;
    }

    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `Data exported to ${filename}.json`
    });
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={exportToCSV}
        className="flex items-center gap-2"
        data-testid="button-export-csv"
      >
        <Download className="w-4 h-4" />
        Export CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportToJSON}
        className="flex items-center gap-2"
        data-testid="button-export-json"
      >
        <Download className="w-4 h-4" />
        Export JSON
      </Button>
    </div>
  );
}