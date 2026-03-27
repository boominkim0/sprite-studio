"""
영상 파일을 프레임 단위로 PNG 이미지로 추출하는 모듈.
ffmpeg를 사용하여 영상의 각 프레임을 개별 PNG 파일로 저장합니다.
"""

import os
import subprocess
import shutil
from typing import List, Optional


def extract_frames(
    video_path: str,
    output_dir: str,
    fps: Optional[int] = None,
) -> List[str]:
    """
    영상 파일에서 프레임을 추출하여 PNG 파일로 저장합니다.

    Args:
        video_path: 입력 영상 파일 경로
        output_dir: 프레임 이미지가 저장될 디렉토리 경로
        fps: 초당 추출할 프레임 수. None이면 원본 fps 사용

    Returns:
        추출된 PNG 파일 경로 리스트 (정렬됨)

    Raises:
        FileNotFoundError: 영상 파일이 존재하지 않을 때
        RuntimeError: ffmpeg 실행 실패 시
    """
    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"영상 파일을 찾을 수 없습니다: {video_path}")

    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg가 설치되어 있지 않습니다. brew install ffmpeg 로 설치해 주세요.")

    os.makedirs(output_dir, exist_ok=True)

    output_pattern = os.path.join(output_dir, "frame_%05d.png")

    cmd = ["ffmpeg", "-y", "-i", video_path]

    if fps is not None:
        cmd.extend(["-vf", f"fps={fps}"])

    cmd.extend(["-vsync", "vfr", output_pattern])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg 프레임 추출 실패:\n{result.stderr}")

    frame_files = sorted(
        [
            os.path.join(output_dir, f)
            for f in os.listdir(output_dir)
            if f.startswith("frame_") and f.endswith(".png")
        ]
    )

    if not frame_files:
        raise RuntimeError("프레임이 추출되지 않았습니다. 영상 파일을 확인해 주세요.")

    print(f"[extract] {len(frame_files)}개 프레임 추출 완료 -> {output_dir}")
    return frame_files
