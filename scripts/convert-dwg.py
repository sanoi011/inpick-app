#!/usr/bin/env python3
"""
DWG → DXF 변환 스크립트
ODA File Converter CLI 래퍼

사용법:
  python scripts/convert-dwg.py

사전 요구사항:
  1. ODA File Converter 설치: https://www.opendesign.com/guestfiles/oda_file_converter
  2. 설치 경로를 ODA_PATH 환경변수로 설정 (또는 기본 경로 사용)

입력: drawings/_arch/*.dwg
출력: drawings/_arch/*.dxf (같은 폴더)
"""

import os
import sys
import subprocess
import glob
from pathlib import Path

# ODA File Converter 기본 경로 (Windows)
ODA_DEFAULT_PATHS = [
    r"C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe",
    r"C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe",
    os.path.expanduser(r"~\AppData\Local\Programs\ODA\ODAFileConverter\ODAFileConverter.exe"),
]

def find_oda_converter():
    """ODA File Converter 실행 경로 찾기"""
    # 환경변수 우선
    env_path = os.environ.get("ODA_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    # 기본 경로 탐색
    for p in ODA_DEFAULT_PATHS:
        if os.path.exists(p):
            return p

    return None

def convert_dwg_to_dxf(input_dir: str, output_dir: str = None):
    """DWG 파일을 DXF로 변환"""

    oda_path = find_oda_converter()

    if not oda_path:
        print("=" * 60)
        print("ODA File Converter가 설치되지 않았습니다.")
        print()
        print("설치 방법:")
        print("  1. https://www.opendesign.com/guestfiles/oda_file_converter 접속")
        print("  2. 무료 계정 생성 후 Windows 버전 다운로드")
        print("  3. 설치 후 이 스크립트를 다시 실행하세요")
        print()
        print("또는 AutoCAD/LibreCAD에서 직접 DXF로 내보내기:")
        print("  파일 > 다른 이름으로 저장 > DXF R2018 형식")
        print("=" * 60)

        # ezdxf로 직접 DWG 읽기 시도 (제한적)
        print("\nezdxf로 직접 읽기를 시도합니다...")
        try_ezdxf_direct(input_dir)
        return

    if output_dir is None:
        output_dir = input_dir

    os.makedirs(output_dir, exist_ok=True)

    dwg_files = glob.glob(os.path.join(input_dir, "*.dwg"))
    if not dwg_files:
        print(f"DWG 파일이 없습니다: {input_dir}")
        return

    print(f"DWG 파일 {len(dwg_files)}개 발견:")
    for f in dwg_files:
        print(f"  - {os.path.basename(f)}")

    # ODA Converter 명령어
    # 형식: ODAFileConverter "InputFolder" "OutputFolder" ACAD2018 DXF 0 1
    # ACAD2018 = AutoCAD 2018 형식, DXF = 출력 형식, 0 = 재귀 아님, 1 = 감사 없음
    cmd = [
        oda_path,
        input_dir,
        output_dir,
        "ACAD2018",  # 출력 버전
        "DXF",       # 출력 형식
        "0",         # 재귀 비활성
        "1",         # 감사 비활성
    ]

    print(f"\n변환 중...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            dxf_files = glob.glob(os.path.join(output_dir, "*.dxf"))
            print(f"\n변환 완료! DXF 파일 {len(dxf_files)}개 생성:")
            for f in dxf_files:
                print(f"  - {os.path.basename(f)}")
        else:
            print(f"변환 실패: {result.stderr}")
    except subprocess.TimeoutExpired:
        print("변환 시간 초과 (120초)")
    except Exception as e:
        print(f"오류: {e}")

def try_ezdxf_direct(input_dir: str):
    """ezdxf로 DWG 직접 읽기 시도 (R2000 이후만 가능)"""
    try:
        import ezdxf

        dwg_files = glob.glob(os.path.join(input_dir, "*.dwg"))
        for dwg_path in dwg_files:
            basename = os.path.splitext(os.path.basename(dwg_path))[0]
            try:
                doc = ezdxf.readfile(dwg_path)
                dxf_path = os.path.join(input_dir, f"{basename}.dxf")
                doc.saveas(dxf_path)
                print(f"  ✓ {basename}.dwg → {basename}.dxf")
            except Exception as e:
                print(f"  ✗ {basename}.dwg: {e}")
                print(f"    → ODA File Converter 설치가 필요합니다")
    except ImportError:
        print("ezdxf가 설치되지 않았습니다: pip install ezdxf")

if __name__ == "__main__":
    project_root = Path(__file__).parent.parent
    drawings_dir = str(project_root / "drawings" / "_arch")

    if not os.path.exists(drawings_dir):
        print(f"도면 디렉토리가 없습니다: {drawings_dir}")
        sys.exit(1)

    convert_dwg_to_dxf(drawings_dir)
