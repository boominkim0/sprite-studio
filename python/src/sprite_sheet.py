"""
투명화된 프레임 이미지들을 하나의 스프라이트 시트로 합치고,
각 프레임의 위치 정보를 JSON으로 생성하는 모듈.
"""

import json
import math
import os
from typing import Any, Dict, List, Optional

from PIL import Image


def create_sprite_sheet(
    frame_paths: List[str],
    output_image_path: str,
    output_json_path: str,
    columns: Optional[int] = None,
    padding: int = 0,
    trim: bool = True,
) -> Dict[str, Any]:
    """
    여러 프레임 이미지를 하나의 스프라이트 시트로 합칩니다.

    Args:
        frame_paths: 프레임 PNG 파일 경로 리스트 (순서대로)
        output_image_path: 출력 스프라이트 시트 이미지 경로
        output_json_path: 출력 JSON 파일 경로
        columns: 스프라이트 시트의 열 수. None이면 자동 계산 (정사각형에 가깝게)
        padding: 프레임 사이 여백 (px)
        trim: True이면 각 프레임의 투명 영역을 잘라냄 (최적화)

    Returns:
        생성된 JSON 메타데이터 딕셔너리
    """
    if not frame_paths:
        raise ValueError("프레임 이미지가 없습니다.")

    # 프레임 이미지 로드 및 정보 수집
    frames_data = []
    for i, path in enumerate(frame_paths):
        img = Image.open(path).convert("RGBA")

        if trim:
            bbox = img.getbbox()  # 투명하지 않은 영역의 바운딩 박스
            if bbox:
                trimmed = img.crop(bbox)
                frames_data.append({
                    "index": i,
                    "image": trimmed,
                    "original_width": img.width,
                    "original_height": img.height,
                    "trim_x": bbox[0],
                    "trim_y": bbox[1],
                    "trim_width": trimmed.width,
                    "trim_height": trimmed.height,
                })
            else:
                # 완전히 투명한 프레임
                frames_data.append({
                    "index": i,
                    "image": Image.new("RGBA", (1, 1), (0, 0, 0, 0)),
                    "original_width": img.width,
                    "original_height": img.height,
                    "trim_x": 0,
                    "trim_y": 0,
                    "trim_width": 1,
                    "trim_height": 1,
                })
        else:
            frames_data.append({
                "index": i,
                "image": img,
                "original_width": img.width,
                "original_height": img.height,
                "trim_x": 0,
                "trim_y": 0,
                "trim_width": img.width,
                "trim_height": img.height,
            })

    num_frames = len(frames_data)

    # 열 수 자동 계산
    if columns is None:
        columns = math.ceil(math.sqrt(num_frames))

    rows = math.ceil(num_frames / columns)

    # 각 프레임의 최대 크기 기준으로 셀 크기 결정 (균일 그리드)
    max_w = max(f["trim_width"] for f in frames_data)
    max_h = max(f["trim_height"] for f in frames_data)
    cell_w = max_w + padding
    cell_h = max_h + padding

    # 스프라이트 시트 크기
    sheet_width = columns * cell_w - padding  # 마지막 열은 패딩 불필요
    sheet_height = rows * cell_h - padding

    print(f"[sprite] 스프라이트 시트: {sheet_width}x{sheet_height}px, {columns}열 x {rows}행, {num_frames}프레임")

    # 스프라이트 시트 생성
    sprite_sheet = Image.new("RGBA", (sheet_width, sheet_height), (0, 0, 0, 0))

    # JSON 메타데이터 구성
    metadata = {
        "meta": {
            "image": os.path.basename(output_image_path),
            "size": {
                "w": sheet_width,
                "h": sheet_height,
            },
            "columns": columns,
            "rows": rows,
            "frame_count": num_frames,
            "cell_width": max_w,
            "cell_height": max_h,
            "padding": padding,
        },
        "frames": [],
    }

    for frame_data in frames_data:
        idx = frame_data["index"]
        col = idx % columns
        row = idx // columns

        x = col * cell_w
        y = row * cell_h

        # 프레임을 셀 내에서 좌상단 정렬로 배치
        sprite_sheet.paste(frame_data["image"], (x, y))

        frame_info = {
            "index": idx,
            "filename": os.path.basename(frame_paths[idx]),
            "frame": {
                "x": x,
                "y": y,
                "w": frame_data["trim_width"],
                "h": frame_data["trim_height"],
            },
            "spriteSourceSize": {
                "x": frame_data["trim_x"],
                "y": frame_data["trim_y"],
                "w": frame_data["trim_width"],
                "h": frame_data["trim_height"],
            },
            "sourceSize": {
                "w": frame_data["original_width"],
                "h": frame_data["original_height"],
            },
            "trimmed": trim and (
                frame_data["trim_width"] != frame_data["original_width"]
                or frame_data["trim_height"] != frame_data["original_height"]
            ),
        }
        metadata["frames"].append(frame_info)

    # 스프라이트 시트 저장
    os.makedirs(os.path.dirname(output_image_path) or ".", exist_ok=True)
    sprite_sheet.save(output_image_path, "PNG", optimize=True)
    print(f"[sprite] 스프라이트 이미지 저장: {output_image_path}")

    # JSON 저장
    os.makedirs(os.path.dirname(output_json_path) or ".", exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"[sprite] JSON 메타데이터 저장: {output_json_path}")

    return metadata
