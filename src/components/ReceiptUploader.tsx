// src/components/ReceiptUploader.tsx
import React, { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "react-toastify";
import api from "@/app/lib/axios";

interface ReceiptUploaderProps {
  onUploadComplete: (keys: string[]) => void;
  uploadedKeys: string[];
  setUploadedKeys: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function ReceiptUploader({ onUploadComplete, uploadedKeys, setUploadedKeys }: ReceiptUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newKeys: string[] = [...uploadedKeys];
    const newNames: string[] = [...fileNames];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Limit size to 5MB
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is larger than the 5MB size limit.`);
        continue;
      }

      try {
        // 1. Get PUT presigned url from API
        const res = await api.post("/remitance/upload-url", {
          contentType: file.type,
          fileName: file.name,
        });

        if (!res.data.success) {
          throw new Error(res.data.error || "Failed to generate upload URL");
        }

        const { uploadUrl, key } = res.data;

        // 2. HTTP PUT request direct upload to Cloudflare R2
        await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        newKeys.push(key);
        newNames.push(file.name);
      } catch (err) {
        console.error("Error uploading file:", err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploadedKeys(newKeys);
    setFileNames(newNames);
    onUploadComplete(newKeys);
    setUploading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    const updatedKeys = uploadedKeys.filter((_, i) => i !== index);
    const updatedNames = fileNames.filter((_, i) => i !== index);
    setUploadedKeys(updatedKeys);
    setFileNames(updatedNames);
    onUploadComplete(updatedKeys);
  };

  return (
    <div className="space-y-3">
      <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">
        Receipt Attachments
      </label>
      
      <div 
        onClick={() => !uploading && fileInputRef.current?.click()}
        className="border-2 border-dashed border-white/10 hover:border-cyan-500/40 rounded-2xl p-6 text-center cursor-pointer bg-white/3 transition-all flex flex-col items-center justify-center gap-2 group"
      >
        <input 
          ref={fileInputRef}
          type="file" 
          multiple 
          accept="image/*,application/pdf" 
          className="hidden" 
          onChange={handleFileChange}
          disabled={uploading}
        />
        {uploading ? (
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-slate-400 group-hover:text-cyan-400 transition-colors" />
        )}
        <span className="text-xs text-slate-300 font-semibold mt-1">
          {uploading ? "Uploading files..." : "Click to select or drag images"}
        </span>
        <span className="text-[10px] text-slate-500">
          Supported: Images, PDF (Max 5MB)
        </span>
      </div>

      {fileNames.length > 0 && (
        <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
          {fileNames.map((name, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-200">
              <div className="flex items-center gap-2 truncate">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{name}</span>
              </div>
              <button 
                type="button" 
                onClick={() => removeFile(index)} 
                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
