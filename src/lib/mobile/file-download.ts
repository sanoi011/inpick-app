import { isNativeApp } from "@/lib/mobile/platform";

export interface SaveBlobInput {
  blob: Blob;
  fileName: string;
  title?: string;
}

export type SaveBlobResult = "browser_download" | "native_share" | "native_preview";

function downloadInBrowser(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error || new Error("파일 데이터를 읽지 못했습니다."));
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("파일 데이터 형식이 올바르지 않습니다."));
        return;
      }
      resolve(dataUrl.slice(commaIndex + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function safeFileName(value: string): string {
  const sanitized = value
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  return sanitized.toLowerCase().endsWith(".pdf")
    ? sanitized
    : `${sanitized}.pdf`;
}

/**
 * 웹은 일반 다운로드를 사용하고, Capacitor 앱은 Cache에 PDF를 쓴 뒤
 * OS 공유 시트를 열어 "파일에 저장"·메일·메신저 전송을 모두 지원한다.
 */
export async function saveOrShareBlob(input: SaveBlobInput): Promise<SaveBlobResult> {
  const fileName = safeFileName(input.fileName);
  if (!isNativeApp()) {
    downloadInBrowser(input.blob, fileName);
    return "browser_download";
  }

  const pdfFile = new File([input.blob], fileName, {
    type: input.blob.type || "application/pdf",
  });
  const sharePayload = {
    title: input.title || fileName,
    files: [pdfFile],
  };
  if (
    typeof navigator.share === "function" &&
    (!navigator.canShare || navigator.canShare(sharePayload))
  ) {
    try {
      await navigator.share(sharePayload);
      return "native_share";
    } catch (error) {
      // 사용자가 공유 시트를 닫은 것은 저장 기능 실패가 아니다.
      if (error instanceof DOMException && error.name === "AbortError") {
        return "native_share";
      }
      console.warn("[mobile-file] Web Share file fallback:", error);
    }
  }

  try {
    const [{ Directory, Filesystem }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const data = await blobToBase64(input.blob);
    const written = await Filesystem.writeFile({
      path: `documents/${Date.now()}-${fileName}`,
      data,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: input.title || fileName,
      dialogTitle: "PDF 저장 또는 공유",
      files: [written.uri],
    });
    return "native_share";
  } catch (error) {
    console.warn("[mobile-file] native save/share unavailable:", error);
    // 구버전 앱처럼 Filesystem 플러그인이 아직 포함되지 않은 셸에서는
    // WebView의 PDF 미리보기를 열어 최소한 OS 공유 메뉴로 접근할 수 있게 한다.
    const url = URL.createObjectURL(input.blob);
    const preview = window.open(url, "_blank");
    if (!preview) {
      URL.revokeObjectURL(url);
      throw new Error(
        "앱의 PDF 저장 기능을 불러오지 못했습니다. 앱을 최신 버전으로 업데이트해주세요.",
      );
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return "native_preview";
  }
}
