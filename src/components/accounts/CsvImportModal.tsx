"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle, Loader2 } from "lucide-react";
import { getLiveSession } from "@/lib/session-client";
import { importAccounts } from "@/lib/live-api";

interface ParsedRow { handle: string; displayName: string; group: string; }

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const rows = lines.slice(1);
  return rows.map((line) => {
    const [handle = "", displayName = "", group = ""] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    return { handle, displayName, group };
  }).filter((r) => r.handle && r.displayName);
}

const EXAMPLE_CSV = `handle,displayName,group
@new_kol_01,新KOL账号一,加密KOL组
@new_kol_02,新KOL账号二,科技KOL组
@new_kol_03,新KOL账号三,AI KOL组`;

export default function CsvImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [imported, setImported] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseCsv(text));
      setImported(false);
      setImportedCount(0);
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const session = await getLiveSession();
      const result = await importAccounts({
        workspace_id: session.selected_workspace.id,
        create_missing_groups: true,
        rows: rows.map((row) => ({
          handle: row.handle.startsWith("@") ? row.handle : `@${row.handle}`,
          display_name: row.displayName,
          group_name: row.group || undefined,
        })),
      });
      setImportedCount(result.created_account_count);
      setImported(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导入账号失败");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setRows([]);
    setImported(false);
    setImportedCount(0);
    setError(null);
    onClose();
  };

  const downloadExample = () => {
    const blob = new Blob([EXAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smartkols_import_example.csv";
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量导入账号</DialogTitle>
          <DialogDescription>上传 CSV 文件批量导入账号。列：handle, displayName, group</DialogDescription>
        </DialogHeader>

        {!imported ? (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-[#E0E0E0] rounded-xl p-8 text-center cursor-pointer hover:border-[#E0E0E0] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-[#999999]" />
              <p className="text-[#111111] text-sm font-medium">点击上传 CSV 文件</p>
              <p className="text-[#999999] text-xs mt-1">支持 UTF-8 编码的 CSV 文件</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>

            <button onClick={downloadExample} className="flex items-center gap-2 text-xs text-[#111111] hover:text-[#999999]">
              <FileText className="w-3.5 h-3.5" />下载示例 CSV 模板
            </button>

            {rows.length > 0 && (
              <div>
                <p className="text-[#999999] text-xs mb-2">预览（共 {rows.length} 条）</p>
                <div className="max-h-52 overflow-y-auto border border-[#E8E8E8] rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-[#E8E8E8]/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-[#999999] font-medium">Handle</th>
                        <th className="px-3 py-2 text-left text-[#999999] font-medium">名称</th>
                        <th className="px-3 py-2 text-left text-[#999999] font-medium">分组</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-t border-[#E8E8E8]/50">
                          <td className="px-3 py-2 text-[#111111]">{row.handle}</td>
                          <td className="px-3 py-2 text-[#111111]">{row.displayName}</td>
                          <td className="px-3 py-2 text-[#999999]">{row.group || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3 justify-end mt-4">
                  <Button variant="outline" onClick={handleClose}>取消</Button>
                  <Button onClick={() => void handleImport()} disabled={importing}>
                    {importing ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />导入中...</> : `确认导入 ${rows.length} 个账号`}
                  </Button>
                </div>
              </div>
            )}
            {error ? <p className="text-sm text-[#D93025]">{error}</p> : null}
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-[#00BA7C]" />
            <p className="text-[#111111] font-medium">成功导入 {importedCount} 个账号</p>
            <Button className="mt-4" onClick={handleClose}>完成</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
