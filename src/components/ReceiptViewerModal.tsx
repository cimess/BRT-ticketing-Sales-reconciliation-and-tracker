// src/components/ReceiptViewerModal.tsx
import React, { useState, useEffect, useCallback } from "react";
import { X, RotateCw, ZoomIn, ZoomOut, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/app/lib/axios";
import { toast } from "react-toastify";

interface ReceiptImage {
  key: string;
  fileName: string;
  viewUrl: string;
  downloadUrl: string;
}

interface ReceiptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  remittanceId: string;
}

export default function ReceiptViewerModal({ isOpen, onClose, remittanceId }: ReceiptViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ReceiptImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);


const fetchImages = useCallback(async () => {
    if (!remittanceId) return;
    setLoading(true);
    try {
      const res = await api.get(`/remitance/${remittanceId}/images`);
      if (res.data.success) {
        setImages(res.data.images || []);
        setCurrentIndex(0);
        setZoom(1);
        setRotation(0);
      }
    } catch (err) {
      toast.error("Failed to load receipt images.");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [remittanceId, onClose]);
  // Synchronize state and trigger side effect cleanly
useEffect(() => {
    if (isOpen && remittanceId) {
      const timer = setTimeout(() => {
        fetchImages();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, remittanceId, fetchImages]);
  if (!isOpen) return null;
  const currentImage = images[currentIndex];


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl h-[85vh] flex flex-col bg-slate-950/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header bar */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/40">
          <div>
            <h3 className="text-sm font-bold text-white">Receipt Attachments</h3>
            {images.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Image {currentIndex + 1} of {images.length} — {currentImage?.fileName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {images.length > 0 && (
              <>
                <button 
                  onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-300 hover:text-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-300 hover:text-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-300 hover:text-white transition-colors"
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <a 
                  href={currentImage?.downloadUrl}
                  download={currentImage?.fileName}
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-300 hover:text-white transition-colors flex items-center justify-center"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
              </>
            )}
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport content */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <span className="text-xs text-slate-400">Loading secure preview...</span>
            </div>
          ) : images.length === 0 ? (
            <span className="text-sm text-slate-500 italic">No attachments found for this remittance record.</span>
          ) : (
            <div 
              className="transition-transform duration-200 ease-out max-h-full max-w-full"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              {currentImage.fileName.toLowerCase().endsWith(".pdf") ? (
                <iframe 
                  src={currentImage.viewUrl} 
                  className="w-[70vw] h-[60vh] border-0" 
                  title="PDF Attachment" 
                />
              ) : (
                <img 
                  src={currentImage.viewUrl} 
                  alt="Receipt Preview" 
                  className="max-h-[65vh] max-w-[85vw] object-contain rounded-lg"
                  draggable={false}
                />
              )}
            </div>
          )}

          {/* Carousel Navigation */}
          {!loading && images.length > 1 && (
            <>
              <button 
                onClick={() => setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1))}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-cyan-500/20 text-white rounded-full transition-all border border-white/10 hover:border-cyan-500/30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1))}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-cyan-500/20 text-white rounded-full transition-all border border-white/10 hover:border-cyan-500/30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
