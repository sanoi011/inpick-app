"use client";

import { useRef } from "react";
import { Camera, Upload, X } from "lucide-react";

interface ImageUploaderProps {
  onImageSelect: (file: File, type: "photo" | "camera") => void;
  className?: string;
}

export default function ImageUploader({ onImageSelect, className = "" }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "camera") => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file, type);
    }
    // 같은 파일 재선택 가능하도록 리셋
    e.target.value = "";
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 카메라 촬영 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileChange(e, "camera")}
        className="hidden"
      />
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors border border-purple-200"
        title="카메라로 촬영"
      >
        <Camera className="w-4 h-4" />
        <span className="hidden sm:inline">카메라 스캔</span>
      </button>

      {/* 파일 업로드 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileChange(e, "photo")}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors border border-gray-200"
        title="사진 업로드"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">사진 업로드</span>
      </button>
    </div>
  );
}

// 이미지 썸네일 리스트 컴포넌트
interface ImageThumbnailListProps {
  images: { id: string; url: string; name: string; type: string }[];
  activeImageId?: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ImageThumbnailList({ images, activeImageId, onSelect, onRemove }: ImageThumbnailListProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {images.map((img) => (
        <div
          key={img.id}
          className={`relative group flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
            activeImageId === img.id ? "border-blue-500 shadow-md" : "border-gray-200 hover:border-gray-400"
          }`}
          onClick={() => onSelect(img.id)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(img.id); }}
            className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-bl-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
            <p className="text-[9px] text-white truncate">
              {img.type === "camera" ? "CAM" : img.type === "floorplan" ? "도면" : "IMG"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
