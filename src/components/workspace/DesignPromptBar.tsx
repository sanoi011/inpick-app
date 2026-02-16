"use client";

import { useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";

const QUICK_PROMPTS = [
  { label: "모던", prompt: "모던한 스타일로 디자인 추천해줘" },
  { label: "북유럽", prompt: "북유럽 스타일로 따뜻하게 디자인해줘" },
  { label: "클래식", prompt: "클래식 고급스러운 스타일로 추천해줘" },
  { label: "미니멀", prompt: "미니멀 깔끔한 스타일로 디자인해줘" },
];

interface Props {
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export default function DesignPromptBar({ onSubmit, isGenerating, disabled }: Props) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    if (!prompt.trim() || isGenerating || disabled) return;
    onSubmit(prompt.trim());
    setPrompt("");
  };

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-3">
      {/* Quick prompt chips */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.label}
            onClick={() => {
              if (!isGenerating && !disabled) {
                onSubmit(qp.prompt);
              }
            }}
            disabled={isGenerating || disabled}
            className="flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3 inline mr-1" />{qp.label}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={disabled ? "도면을 먼저 선택해주세요" : "디자인 스타일을 입력하세요..."}
          disabled={isGenerating || disabled}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isGenerating || disabled}
          className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
