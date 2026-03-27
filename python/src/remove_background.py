"""
PNG 이미지의 배경을 투명하게 만드는 모듈.
단색 배경을 감지하여 투명(alpha=0)으로 변환합니다.
"""

import os
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image


def detect_background_color(
    image: Image.Image,
    sample_size: int = 20,
) -> Tuple[int, int, int]:
    """
    이미지의 네 모서리를 샘플링하여 배경 색상을 추정합니다.

    Args:
        image: PIL Image 객체
        sample_size: 모서리에서 샘플링할 픽셀 영역 크기

    Returns:
        (R, G, B) 배경 색상 튜플
    """
    img_array = np.array(image.convert("RGB"))
    h, w = img_array.shape[:2]
    s = min(sample_size, h // 4, w // 4)

    corners = [
        img_array[:s, :s],           # 좌상단
        img_array[:s, w - s:],       # 우상단
        img_array[h - s:, :s],       # 좌하단
        img_array[h - s:, w - s:],   # 우하단
    ]

    all_pixels = np.concatenate([c.reshape(-1, 3) for c in corners], axis=0)
    median_color = np.median(all_pixels, axis=0).astype(int)

    return tuple(median_color.tolist())


def remove_background(
    image: Image.Image,
    bg_color: Optional[Tuple[int, int, int]] = None,
    tolerance: int = 30,
) -> Image.Image:
    """
    이미지에서 배경 색상을 투명하게 변환합니다.

    Args:
        image: 입력 PIL Image
        bg_color: 제거할 배경 색상 (R,G,B). None이면 자동 감지
        tolerance: 색상 차이 허용 범위 (0~255). 값이 클수록 더 많은 색상을 배경으로 판단

    Returns:
        배경이 투명한 RGBA Image
    """
    if bg_color is None:
        bg_color = detect_background_color(image)

    img_rgb = np.array(image.convert("RGB"), dtype=np.float32)
    bg = np.array(bg_color, dtype=np.float32)

    # 각 픽셀과 배경 색상 사이의 유클리드 거리 계산
    diff = np.sqrt(np.sum((img_rgb - bg) ** 2, axis=2))

    # tolerance 이내의 픽셀을 배경으로 판단
    is_bg = diff <= tolerance

    # 경계 부분에 대해 부드러운 알파 전환 (anti-aliasing)
    # tolerance ~ tolerance*1.5 사이는 반투명으로 처리
    edge_range = tolerance * 0.5
    alpha = np.ones(diff.shape, dtype=np.float32) * 255.0
    alpha[is_bg] = 0.0

    edge_mask = (~is_bg) & (diff <= tolerance + edge_range)
    if edge_range > 0:
        alpha[edge_mask] = ((diff[edge_mask] - tolerance) / edge_range) * 255.0

    alpha = np.clip(alpha, 0, 255).astype(np.uint8)

    # RGBA 이미지 생성
    rgba = np.dstack([np.array(image.convert("RGB"), dtype=np.uint8), alpha])
    return Image.fromarray(rgba, "RGBA")


def process_frames(
    frame_paths: List[str],
    output_dir: str,
    bg_color: Optional[Tuple[int, int, int]] = None,
    tolerance: int = 30,
) -> List[str]:
    """
    여러 프레임 이미지의 배경을 일괄 투명화합니다.

    Args:
        frame_paths: 프레임 PNG 파일 경로 리스트
        output_dir: 투명화된 이미지 저장 디렉토리
        bg_color: 제거할 배경 색상. None이면 첫 번째 프레임에서 자동 감지
        tolerance: 색상 차이 허용 범위

    Returns:
        투명화된 PNG 파일 경로 리스트
    """
    os.makedirs(output_dir, exist_ok=True)

    # 첫 번째 프레임에서 배경 색상 감지
    if bg_color is None:
        first_img = Image.open(frame_paths[0])
        bg_color = detect_background_color(first_img)
        print(f"[transparent] 감지된 배경 색상: RGB{bg_color}")

    transparent_paths = []
    total = len(frame_paths)

    for i, path in enumerate(frame_paths):
        img = Image.open(path)
        transparent_img = remove_background(img, bg_color, tolerance)

        filename = os.path.basename(path)
        output_path = os.path.join(output_dir, filename)
        transparent_img.save(output_path, "PNG")
        transparent_paths.append(output_path)

        if (i + 1) % 10 == 0 or (i + 1) == total:
            print(f"[transparent] 진행: {i + 1}/{total}")

    print(f"[transparent] {len(transparent_paths)}개 프레임 배경 투명화 완료 -> {output_dir}")
    return transparent_paths
