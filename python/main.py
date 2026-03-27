#!/usr/bin/env python3
"""
Video to Sprite - 영상을 스프라이트 이미지로 변환하는 도구

파이프라인:
1. 영상 -> 프레임 PNG 추출 (ffmpeg)
2. 프레임 PNG 배경 투명화
3. 투명 프레임 -> 스프라이트 시트 생성
4. 프레임 위치 정보 JSON 생성
"""

import argparse
import os
import shutil
import sys
import time
from typing import Optional

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.extract_frames import extract_frames
from src.remove_background import process_frames
from src.sprite_sheet import create_sprite_sheet


def run_pipeline(
    video_path: str,
    output_dir: str,
    fps: Optional[int] = None,
    bg_color: Optional[tuple] = None,
    tolerance: int = 30,
    columns: Optional[int] = None,
    padding: int = 0,
    trim: bool = True,
    keep_temp: bool = False,
    export_frames: bool = False,
):
    """
    전체 파이프라인을 실행합니다.

    Args:
        video_path: 입력 영상 파일 경로
        output_dir: 출력 디렉토리
        fps: 추출 fps (None이면 원본 fps)
        bg_color: 배경 색상 (R,G,B) 또는 None (자동 감지)
        tolerance: 배경 색상 허용 범위
        columns: 스프라이트 시트 열 수 (None이면 자동)
        padding: 프레임 간 여백 (px)
        trim: 투명 영역 트림 여부
        keep_temp: True이면 중간 결과물 유지
        export_frames: True이면 배경 제거된 개별 프레임 이미지를 frames/ 폴더에 저장
    """
    start_time = time.time()

    video_name = os.path.splitext(os.path.basename(video_path))[0]
    output_dir = os.path.join(output_dir, video_name)
    os.makedirs(output_dir, exist_ok=True)

    frames_dir = os.path.join(output_dir, "_temp_frames")
    transparent_dir = os.path.join(output_dir, "_temp_transparent")
    sprite_image_path = os.path.join(output_dir, f"{video_name}_sprite.png")
    sprite_json_path = os.path.join(output_dir, f"{video_name}_sprite.json")

    print("=" * 60)
    print(f"  Video to Sprite")
    print(f"  입력: {video_path}")
    print(f"  출력: {output_dir}")
    print("=" * 60)

    # Step 1: 프레임 추출
    print("\n[Step 1/4] 영상에서 프레임 추출 중...")
    frame_paths = extract_frames(video_path, frames_dir, fps=fps)

    # Step 2: 배경 투명화
    print("\n[Step 2/4] 프레임 배경 투명화 중...")
    transparent_paths = process_frames(
        frame_paths, transparent_dir, bg_color=bg_color, tolerance=tolerance
    )

    # Step 3 & 4: 스프라이트 시트 + JSON 생성
    print("\n[Step 3/4] 스프라이트 시트 생성 중...")
    metadata = create_sprite_sheet(
        transparent_paths,
        sprite_image_path,
        sprite_json_path,
        columns=columns,
        padding=padding,
        trim=trim,
    )

    # 개별 프레임 이미지 내보내기
    if export_frames:
        frames_export_dir = os.path.join(output_dir, "frames")
        os.makedirs(frames_export_dir, exist_ok=True)
        print("\n[export] 개별 프레임 이미지 내보내기 중...")
        for tp in transparent_paths:
            dest = os.path.join(frames_export_dir, os.path.basename(tp))
            shutil.copy2(tp, dest)
        print(f"[export] {len(transparent_paths)}개 프레임 이미지 저장 완료 -> {frames_export_dir}")

    # 임시 파일 정리
    if not keep_temp:
        print("\n[Step 4/4] 임시 파일 정리 중...")
        shutil.rmtree(frames_dir, ignore_errors=True)
        shutil.rmtree(transparent_dir, ignore_errors=True)
        print("[cleanup] 임시 파일 삭제 완료")
    else:
        print("\n[Step 4/4] 임시 파일 유지 (--keep-temp)")

    elapsed = time.time() - start_time

    print("\n" + "=" * 60)
    print(f"  완료! ({elapsed:.1f}초)")
    print(f"  스프라이트 이미지: {sprite_image_path}")
    print(f"  JSON 메타데이터:   {sprite_json_path}")
    sheet_meta = metadata["meta"]
    print(f"  시트 크기: {sheet_meta['size']['w']}x{sheet_meta['size']['h']}px")
    print(f"  프레임 수: {sheet_meta['frame_count']}개 ({sheet_meta['columns']}x{sheet_meta['rows']})")
    print("=" * 60)

    return metadata


def parse_color(color_str: str) -> tuple:
    """'R,G,B' 형식의 문자열을 튜플로 변환합니다."""
    parts = color_str.strip().split(",")
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("색상은 'R,G,B' 형식이어야 합니다 (예: 255,255,255)")
    try:
        r, g, b = int(parts[0]), int(parts[1]), int(parts[2])
        if not all(0 <= v <= 255 for v in (r, g, b)):
            raise ValueError
        return (r, g, b)
    except ValueError:
        raise argparse.ArgumentTypeError("색상 값은 0-255 사이의 정수여야 합니다")


def main():
    parser = argparse.ArgumentParser(
        description="영상 파일을 스프라이트 시트 이미지로 변환합니다.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예시:
  python main.py video.mp4
  python main.py video.mp4 -o ./output --fps 12
  python main.py video.mp4 --bg-color 0,255,0 --tolerance 40
  python main.py video.mp4 --columns 10 --padding 2 --no-trim
        """,
    )

    parser.add_argument(
        "video",
        help="입력 영상 파일 경로",
    )
    parser.add_argument(
        "-o", "--output",
        default="./output",
        help="출력 디렉토리 (기본값: ./output)",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=None,
        help="초당 추출할 프레임 수 (기본값: 원본 fps)",
    )
    parser.add_argument(
        "--bg-color",
        type=parse_color,
        default=None,
        help="배경 색상 'R,G,B' (기본값: 자동 감지)",
    )
    parser.add_argument(
        "--tolerance",
        type=int,
        default=30,
        help="배경 색상 허용 범위 0-255 (기본값: 30)",
    )
    parser.add_argument(
        "--columns",
        type=int,
        default=None,
        help="스프라이트 시트 열 수 (기본값: 자동 계산)",
    )
    parser.add_argument(
        "--padding",
        type=int,
        default=0,
        help="프레임 간 여백 px (기본값: 0)",
    )
    parser.add_argument(
        "--no-trim",
        action="store_true",
        help="투명 영역 트림 비활성화",
    )
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="중간 결과물(프레임 이미지)을 유지",
    )
    parser.add_argument(
        "--export-frames",
        action="store_true",
        help="배경 제거된 개별 프레임 이미지를 frames/ 폴더에 저장",
    )

    args = parser.parse_args()

    run_pipeline(
        video_path=args.video,
        output_dir=args.output,
        fps=args.fps,
        bg_color=args.bg_color,
        tolerance=args.tolerance,
        columns=args.columns,
        padding=args.padding,
        trim=not args.no_trim,
        keep_temp=args.keep_temp,
        export_frames=args.export_frames,
    )


if __name__ == "__main__":
    main()
