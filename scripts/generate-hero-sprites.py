#!/usr/bin/env python3
"""Generate first-pass hero spritesheets for the Phaser runtime.

These sheets intentionally prioritize readability and animation coverage over
high-detail art. They match the existing animation rows in
`src/config/manifest.json` and give the game concrete hero silhouettes instead
of the current primitive fallback circles.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import math
import subprocess
import tempfile


FRAME = 64


@dataclass(frozen=True)
class HeroSpec:
    key: str
    filename: str
    rows: list[tuple[str, int]]
    skin: str
    outline: str
    shirt: str
    shirt2: str
    accent: str
    accent2: str
    shorts: str
    hair: str
    hat: str
    glasses: str
    glow: str
    weapon: str
    full_h: float
    shoulder_w: float
    torso_w: float
    shorts_w: float
    head_w: float
    leg_h: float
    shoe: str
    shoe2: str


HEROES = [
    HeroSpec(
        key="eliott",
        filename="elliot.png",
        rows=[("idle", 4), ("walk", 6), ("attack", 4), ("blink", 3), ("death", 6)],
        skin="#e8b888",
        outline="#1a0f06",
        shirt="#ef4b3b",
        shirt2="#2d66d6",
        accent="#f5d04a",
        accent2="#40c8c0",
        shorts="#7aa24e",
        hair="#bfa270",
        hat="#d9cfbe",
        glasses="#f0c431",
        glow="#80c8ff",
        weapon="club",
        full_h=29.5,
        shoulder_w=20.5,
        torso_w=18.5,
        shorts_w=17.5,
        head_w=20.0,
        leg_h=8.5,
        shoe="#2f8b63",
        shoe2="#1d3a36",
    ),
    HeroSpec(
        key="dick",
        filename="dick.png",
        rows=[("idle", 4), ("walk", 6), ("attack", 4), ("rage", 4), ("death", 6)],
        skin="#d8a878",
        outline="#1a0f06",
        shirt="#f3d8da",
        shirt2="#9ec7eb",
        accent="#f8efde",
        accent2="#181818",
        shorts="#1b1b20",
        hair="#2a1a0a",
        hat="#111827",
        glasses="#4d97d9",
        glow="#ff6040",
        weapon="long_club",
        full_h=31.5,
        shoulder_w=26.0,
        torso_w=22.0,
        shorts_w=19.0,
        head_w=21.0,
        leg_h=8.5,
        shoe="#d8d0c4",
        shoe2="#7a746b",
    ),
    HeroSpec(
        key="habib",
        filename="habib.png",
        rows=[("idle", 4), ("walk", 6), ("attack", 5), ("casting", 4), ("death", 6)],
        skin="#d4a878",
        outline="#1a0f06",
        shirt="#ece8dc",
        shirt2="#b59a5d",
        accent="#c7514e",
        accent2="#2a2a2a",
        shorts="#cf554c",
        hair="#3a2a15",
        hat="#0d0d0d",
        glasses="#262626",
        glow="#c8a0ff",
        weapon="staff",
        full_h=30.5,
        shoulder_w=21.5,
        torso_w=18.5,
        shorts_w=16.5,
        head_w=19.0,
        leg_h=9.5,
        shoe="#262626",
        shoe2="#4a4a4a",
    ),
]


def clamp(value: float, low: int = 0, high: int = 255) -> int:
    return max(low, min(high, int(round(value))))


def shift(hex_color: str, factor: float) -> str:
    value = hex_color.lstrip("#")
    r = int(value[0:2], 16)
    g = int(value[2:4], 16)
    b = int(value[4:6], 16)
    if factor >= 0:
      r = clamp(r + (255 - r) * factor)
      g = clamp(g + (255 - g) * factor)
      b = clamp(b + (255 - b) * factor)
    else:
      scale = 1 + factor
      r = clamp(r * scale)
      g = clamp(g * scale)
      b = clamp(b * scale)
    return f"#{r:02x}{g:02x}{b:02x}"


def line(x1: float, y1: float, x2: float, y2: float, color: str, width: float, cap: str = "round", opacity: float = 1.0) -> str:
    return (
        f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
        f'stroke="{color}" stroke-width="{width:.1f}" stroke-linecap="{cap}" opacity="{opacity:.3f}" />'
    )


def ellipse(cx: float, cy: float, rx: float, ry: float, fill: str, stroke: str | None = None, stroke_w: float = 1.0, opacity: float = 1.0) -> str:
    attrs = [f'cx="{cx:.1f}"', f'cy="{cy:.1f}"', f'rx="{rx:.1f}"', f'ry="{ry:.1f}"', f'fill="{fill}"', f'opacity="{opacity:.3f}"']
    if stroke:
        attrs.append(f'stroke="{stroke}"')
        attrs.append(f'stroke-width="{stroke_w:.1f}"')
    return f"<ellipse {' '.join(attrs)} />"


def circle(cx: float, cy: float, r: float, fill: str, stroke: str | None = None, stroke_w: float = 1.0, opacity: float = 1.0) -> str:
    attrs = [f'cx="{cx:.1f}"', f'cy="{cy:.1f}"', f'r="{r:.1f}"', f'fill="{fill}"', f'opacity="{opacity:.3f}"']
    if stroke:
        attrs.append(f'stroke="{stroke}"')
        attrs.append(f'stroke-width="{stroke_w:.1f}"')
    return f"<circle {' '.join(attrs)} />"


def rect(x: float, y: float, w: float, h: float, fill: str, rx: float = 0, stroke: str | None = None, stroke_w: float = 1.0, opacity: float = 1.0) -> str:
    attrs = [f'x="{x:.1f}"', f'y="{y:.1f}"', f'width="{w:.1f}"', f'height="{h:.1f}"', f'fill="{fill}"', f'opacity="{opacity:.3f}"']
    if rx:
        attrs.append(f'rx="{rx:.1f}"')
    if stroke:
        attrs.append(f'stroke="{stroke}"')
        attrs.append(f'stroke-width="{stroke_w:.1f}"')
    return f"<rect {' '.join(attrs)} />"


def path(d: str, fill: str = "none", stroke: str | None = None, stroke_w: float = 1.0, opacity: float = 1.0, linecap: str = "round", linejoin: str = "round") -> str:
    attrs = [f'd="{d}"', f'fill="{fill}"', f'opacity="{opacity:.3f}"']
    if stroke:
        attrs.append(f'stroke="{stroke}"')
        attrs.append(f'stroke-width="{stroke_w:.1f}"')
        attrs.append(f'stroke-linecap="{linecap}"')
        attrs.append(f'stroke-linejoin="{linejoin}"')
    return f"<path {' '.join(attrs)} />"


def poly(points: list[tuple[float, float]], fill: str, stroke: str | None = None, stroke_w: float = 1.0, opacity: float = 1.0) -> str:
    p = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    attrs = [f'points="{p}"', f'fill="{fill}"', f'opacity="{opacity:.3f}"']
    if stroke:
        attrs.append(f'stroke="{stroke}"')
        attrs.append(f'stroke-width="{stroke_w:.1f}"')
        attrs.append('stroke-linejoin="round"')
    return f"<polygon {' '.join(attrs)} />"


def frame_group(x: int, y: int, content: str) -> str:
    return f'<g transform="translate({x},{y})">{content}</g>'


def make_weapon(spec: HeroSpec, row: str, progress: float, body_x: float, body_y: float) -> str:
    arm_y = body_y - 1
    outline = spec.outline
    if spec.weapon == "club":
        swing = math.sin(progress * math.pi) * 18
        tip_x = body_x + 10 + swing * (1 if row == "attack" else 0.25)
        tip_y = arm_y - 8 + (1 - math.cos(progress * math.pi)) * 5
        return (
            line(body_x + 6, arm_y, tip_x, tip_y, "#7b5434", 3.2)
            + circle(tip_x + 1.5, tip_y - 1.0, 2.6, spec.accent, outline, 0.9)
        )
    if spec.weapon == "long_club":
        swing = math.sin(progress * math.pi) * 22
        base_x = body_x + 7
        base_y = arm_y
        tip_x = base_x + 18 + swing * (1 if row in {"attack", "rage"} else 0.1)
        tip_y = base_y - 10 + (1 - math.cos(progress * math.pi)) * 4
        return line(base_x, base_y, tip_x, tip_y, "#5e3b22", 3.8) + rect(tip_x - 2, tip_y - 2, 5, 4, "#3a2515", 1.5, outline, 0.7)
    flare = 4 + math.sin(progress * math.pi) * 3
    return (
        line(body_x + 6, arm_y, body_x + 16, arm_y - 6, "#8d7660", 3.0)
        + circle(body_x + 18, arm_y - 7, flare, spec.glow, opacity=0.18)
        + circle(body_x + 18, arm_y - 7, flare * 0.45, spec.glow, opacity=0.32)
    )


def build_hero_frame(spec: HeroSpec, row: str, frame_idx: int, frames: int) -> str:
    progress = 0 if frames <= 1 else frame_idx / (frames - 1)
    phase = 0 if frames <= 1 else (frame_idx / frames) * math.pi * 2
    bob = math.sin(phase) * 1.2 if row in {"idle", "walk"} else 0
    walk = math.sin(phase) if row == "walk" else 0
    body_x = 31
    foot_y = 49.5
    leg_h = spec.leg_h
    shorts_ry = 5.6
    shorts_rx = spec.shorts_w / 2
    torso_rx = spec.torso_w / 2
    torso_ry = 8.8 if spec.key != "dick" else 9.8
    head_r = spec.head_w / 2
    shoulders_y = foot_y - leg_h - shorts_ry - torso_ry + bob
    body_y = shoulders_y + torso_ry - 1.2
    head_y = shoulders_y - head_r + 2.0
    shoulder_shift = 0.8 if spec.key == "dick" else (-0.3 if spec.key == "eliott" else -0.1)
    shoulder_left = body_x - spec.shoulder_w / 2
    shoulder_right = body_x + spec.shoulder_w / 2
    shorts_y = foot_y - leg_h - 1.8
    elbow_push = 0.2 if spec.key == "habib" else (1.0 if spec.key == "dick" else 0.5)
    hand_r = 2.0 if spec.key != "dick" else 2.5
    shoe_w = 5.2 if spec.key != "dick" else 6.4
    shoe_h = 2.9 if spec.key != "dick" else 3.3

    if row == "death":
        flatten = progress
        fade = 1 - progress * 0.18
        return (
            ellipse(31, 47, 14 - flatten * 2, 4.5, "rgba(0,0,0,0.18)", opacity=0.55)
            + ellipse(30 + flatten * 5, 34 + flatten * 8, 16, 8 - flatten * 2.5, shift(spec.shirt, -0.1), spec.outline, 1.2, fade)
            + circle(20 + flatten * 10, 31 + flatten * 9, 7.5, shift(spec.skin, -0.08), spec.outline, 1.1, fade)
            + line(22 + flatten * 4, 41 + flatten * 5, 12 + flatten * 2, 50, shift(spec.shorts, -0.1), 3.0, opacity=fade)
            + line(36 + flatten * 5, 41 + flatten * 6, 47, 48 + flatten * 2, shift(spec.shorts, -0.1), 3.0, opacity=fade)
            + line(30 + flatten * 8, 30 + flatten * 7, 43 + flatten * 6, 24 + flatten * 7, shift(spec.hair, -0.15), 4.2, opacity=0.6)
        )

    shapes: list[str] = []

    if row == "blink":
        ghost_alpha = [0.24, 0.16, 0.24][frame_idx]
        for dx in (-10, 10):
            shapes.append(circle(body_x + dx, body_y - 6, 9, spec.glow, opacity=ghost_alpha))
            shapes.append(ellipse(body_x + dx - 2, body_y + 8, 11, 9, spec.glow, opacity=ghost_alpha * 0.8))
        streak_y = 38 - frame_idx * 2
        shapes.append(path(f"M12,{streak_y} C24,{streak_y - 8} 42,{streak_y + 8} 54,{streak_y - 2}", stroke=spec.glow, stroke_w=2.6, opacity=0.55))
        if frame_idx == 1:
            shapes.append(circle(body_x, body_y - 8, 8.5, spec.glow, opacity=0.42))
            shapes.append(ellipse(body_x - 1, body_y + 7, 10, 8, spec.glow, opacity=0.32))

    if row == "rage":
        aura = 5 + math.sin(progress * math.pi) * 2
        shapes.append(circle(body_x + 2, body_y - 7, 12 + aura, spec.glow, opacity=0.16))
        shapes.append(ellipse(body_x - 1, body_y + 8, 15 + aura, 12 + aura * 0.7, spec.glow, opacity=0.10))
        for x in (20, 27, 36, 43):
            shapes.append(path(f"M{x},{body_y + 18:.1f} l2,-6 l2,4", stroke=spec.glow, stroke_w=1.5, opacity=0.38))

    if row == "casting":
        ring_r = 10 + math.sin(progress * math.pi) * 4
        shapes.append(ellipse(body_x + 12, body_y + 2, ring_r, 6 + ring_r * 0.12, "none", spec.glow, 2.0, 0.65))
        shapes.append(path(f"M18,{body_y + 4:.1f} C26,{body_y - 10:.1f} 38,{body_y + 18:.1f} 48,{body_y - 1:.1f}", stroke=spec.glow, stroke_w=1.8, opacity=0.5))

    leg_left = body_x - shorts_rx * 0.35
    leg_right = body_x + shorts_rx * 0.35
    arm_left_y = shoulders_y + 1
    arm_right_y = shoulders_y + 1 + (walk * 0.8 if row == "walk" else 0)
    left_leg_y = foot_y + (walk * 2.6 if row == "walk" else 0)
    right_leg_y = foot_y - (walk * 2.6 if row == "walk" else 0)
    left_arm_tip_y = body_y + 4.8 - (walk * 0.8 if row == "walk" else 0)
    right_arm_tip_y = body_y + 5.0 + (walk * 0.8 if row == "walk" else 0)
    left_hand_x = body_x - torso_rx * 0.8 - elbow_push
    right_hand_x = body_x + torso_rx * 0.8 + elbow_push

    if row == "attack":
        arm_right_y = shoulders_y - 1.2
        right_arm_tip_y = body_y + 1.5
        right_hand_x = body_x + torso_rx + 1.8
    elif row == "rage":
        arm_left_y = shoulders_y - 0.8
        arm_right_y = shoulders_y - 0.8
        left_arm_tip_y = body_y + 2.5
        right_arm_tip_y = body_y + 2.5
        left_hand_x = body_x - torso_rx - 1.2
        right_hand_x = body_x + torso_rx + 1.2
    elif row == "casting":
        right_arm_tip_y = body_y + 1.5
        left_arm_tip_y = body_y + 1.8
        right_hand_x = body_x + torso_rx + 1.4
        left_hand_x = body_x - torso_rx * 0.65

    shapes.append(line(leg_left, shorts_y + 2.1, leg_left - 1.4, left_leg_y - 0.5, shift(spec.shorts, -0.14), 3.0))
    shapes.append(line(leg_right, shorts_y + 2.1, leg_right + 1.4, right_leg_y - 0.5, shift(spec.shorts, -0.14), 3.0))
    shapes.append(line(shoulder_left + 1.5, arm_left_y, left_hand_x, left_arm_tip_y, spec.skin, 3.2))
    shapes.append(line(shoulder_right - 1.5, arm_right_y, right_hand_x, right_arm_tip_y, spec.skin, 3.2))

    shapes.append(ellipse(body_x + shoulder_shift, shorts_y, shorts_rx, shorts_ry, spec.shorts, spec.outline, 1.0))
    shapes.append(ellipse(body_x + shoulder_shift, body_y + 1.4, torso_rx, torso_ry, spec.shirt, spec.outline, 1.3))
    shapes.append(ellipse(body_x + 1.4, body_y + 4.5, torso_rx - 1, 5.6, shift(spec.shirt, -0.14), opacity=0.3))
    shapes.append(circle(body_x + 1.4, head_y, head_r, spec.skin, spec.outline, 1.2))
    shapes.append(circle(left_hand_x, left_arm_tip_y, hand_r, spec.skin, spec.outline, 0.9))
    shapes.append(circle(right_hand_x, right_arm_tip_y, hand_r, spec.skin, spec.outline, 0.9))
    shapes.append(ellipse(leg_left - 1.6, left_leg_y + 0.7, shoe_w, shoe_h, spec.shoe, spec.outline, 0.9))
    shapes.append(ellipse(leg_right + 1.6, right_leg_y + 0.7, shoe_w, shoe_h, spec.shoe, spec.outline, 0.9))
    shapes.append(rect(leg_left - 1.6 - shoe_w * 0.45, left_leg_y + 1.2, shoe_w * 0.9, 1.1, spec.shoe2, 0.5, opacity=0.85))
    shapes.append(rect(leg_right + 1.6 - shoe_w * 0.45, right_leg_y + 1.2, shoe_w * 0.9, 1.1, spec.shoe2, 0.5, opacity=0.85))

    if spec.key == "eliott":
        shapes.append(path(f"M{body_x - 9},{body_y - 1} q8,-11 18,-1", stroke=spec.shirt2, stroke_w=5.2, opacity=0.95))
        shapes.append(path(f"M{body_x - 10},{body_y + 3} q9,-7 21,3", stroke=spec.accent, stroke_w=4.4, opacity=0.92))
        shapes.append(path(f"M{body_x - 8},{body_y + 6} q7,4 16,-1", stroke="#4caf50", stroke_w=4.0, opacity=0.9))
        shapes.append(path(f"M{body_x - 8},{body_y + 9} q7,-2 14,2", stroke="#7b1fa2", stroke_w=3.3, opacity=0.74))
        shapes.append(circle(body_x - 2.8, head_y - 1.2, 1.65, spec.glasses, opacity=0.92))
        shapes.append(circle(body_x + 5.0, head_y - 1.2, 1.65, spec.glasses, opacity=0.92))
        shapes.append(rect(body_x - 0.6, head_y - 1.5, 2.2, 0.7, "#a06d20", 0.3, opacity=0.82))
        shapes.append(ellipse(body_x + 1.0, head_y - 3.8, 11.6, 4.0, spec.hat, spec.outline, 1.0))
        shapes.append(rect(body_x - 4.6, head_y - 8.9, 11.2, 4.6, shift(spec.hat, -0.06), 1.4, spec.outline, 0.9))
        shapes.append(circle(body_x - 4.8, shorts_y + 0.8, 1.2, "#dce8bf", opacity=0.82))
        shapes.append(circle(body_x + 0.8, shorts_y - 1.6, 1.2, "#8fd86f", opacity=0.82))
        shapes.append(circle(body_x + 5.2, shorts_y + 1.2, 1.0, "#d6f1a2", opacity=0.72))
    elif spec.key == "dick":
        for x, color in ((body_x - 9, spec.shirt2), (body_x - 3, spec.accent), (body_x + 3, "#f5eec9"), (body_x + 9, "#d6b6e9")):
            shapes.append(path(f"M{x},{body_y - 2} q1.5,8.5 0,15", stroke=color, stroke_w=3.4, opacity=0.9))
        shapes.append(ellipse(body_x + 1.4, head_y - 4.1, 10.2, 4.0, spec.hat, spec.outline, 1.0))
        shapes.append(rect(body_x - 6.2, head_y - 9.0, 15.4, 5.2, spec.hat, 1.2, spec.outline, 1.0))
        shapes.append(rect(body_x - 0.4, head_y - 8.2, 1.7, 2.7, "#ffffff", opacity=0.95))
        shapes.append(rect(body_x + 2.0, head_y - 8.2, 1.7, 2.7, "#ffffff", opacity=0.95))
        shapes.append(rect(body_x + 4.4, head_y - 8.2, 1.7, 2.7, "#ffffff", opacity=0.95))
        shapes.append(circle(body_x - 2.0, head_y - 0.8, 2.35, spec.glasses, opacity=0.92))
        shapes.append(circle(body_x + 5.2, head_y - 0.8, 2.35, spec.glasses, opacity=0.92))
        shapes.append(rect(body_x + 0.2, head_y - 1.1, 2.8, 0.7, "#d5e7ff", 0.3, opacity=0.86))
        shapes.append(path(f"M{body_x - 0.6},{head_y + 5.0} q2.8,1.8 5.8,0", stroke=shift(spec.skin, -0.18), stroke_w=1.2))
        if row == "rage":
            shapes.append(rect(body_x - 0.8, head_y - 1.6, 2.0, 1.2, "#ffddb8"))
            shapes.append(rect(body_x + 4.6, head_y - 1.6, 2.0, 1.2, "#ffddb8"))
            shapes.append(circle(body_x, head_y - 0.8, 1.5, spec.glow, opacity=0.9))
            shapes.append(circle(body_x + 5.9, head_y - 0.8, 1.5, spec.glow, opacity=0.9))
    else:
        shapes.append(rect(body_x - 7.2, body_y - 0.6, 14.4, 10.2, spec.shirt2, 1.6, opacity=0.28))
        shapes.append(path(f"M{body_x - 1.5},{body_y + 1.6} l3.2,3.4 l3.2,-3.4", stroke=spec.accent2, stroke_w=1.1, opacity=0.95))
        shapes.append(path(f"M{body_x - 5.0},{body_y + 3.2} q6.6,-5.8 13.2,1.4", stroke=spec.accent, stroke_w=2.1, opacity=0.7))
        shapes.append(path(f"M{body_x - 5.6},{head_y - 3.1} q7.2,-6.4 14.6,0", fill=spec.hair, stroke=spec.outline, stroke_w=1.0))
        shapes.append(rect(body_x - 2.2, head_y - 9.2, 7.2, 1.8, spec.glasses, 0.6, opacity=0.55))
        shapes.append(rect(body_x - 0.8, head_y - 11.1, 6.0, 1.6, "#1d1d1d", 0.6, opacity=0.9))

    shapes.append(rect(body_x - 1.0, head_y - 1.2, 1.5, 1.0, spec.outline))
    shapes.append(rect(body_x + 3.8, head_y - 1.2, 1.5, 1.0, spec.outline))
    shapes.append(path(f"M{body_x + 0.2},{head_y + 3.8} q2.2,1.4 4.6,0", stroke=shift(spec.skin, -0.18), stroke_w=1.0))

    if row in {"attack", "rage", "casting"}:
        shapes.append(make_weapon(spec, row, progress, body_x, body_y))
    else:
        shapes.append(make_weapon(spec, row, 0.2, body_x, body_y))

    if row == "attack":
        shapes.append(path(f"M43,{body_y - 6:.1f} q7,-5 11,2", stroke=shift(spec.glow, 0.08), stroke_w=2.0, opacity=0.42))

    return "".join(shapes)


def build_svg(spec: HeroSpec) -> str:
    max_frames = max(frames for _, frames in spec.rows)
    width = FRAME * max_frames
    height = FRAME * len(spec.rows)
    groups: list[str] = []
    for row_idx, (row_name, frames) in enumerate(spec.rows):
        for frame_idx in range(frames):
            groups.append(frame_group(frame_idx * FRAME, row_idx * FRAME, build_hero_frame(spec, row_name, frame_idx, frames)))
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        f'<rect width="{width}" height="{height}" fill="none" />'
        + "".join(groups)
        + "</svg>"
    )


def render_sheet(spec: HeroSpec, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / spec.filename
    svg = build_svg(spec)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_svg = Path(tmpdir) / f"{spec.key}.svg"
        tmp_svg.write_text(svg, encoding="utf-8")
        subprocess.run(
            ["magick", "-background", "none", str(tmp_svg), f"PNG32:{out_path}"],
            check=True,
        )


def main() -> None:
    out_dir = Path(__file__).resolve().parents[1] / "public" / "assets" / "sprites" / "heroes"
    for spec in HEROES:
        render_sheet(spec, out_dir)
        print(f"wrote {out_dir / spec.filename}")


if __name__ == "__main__":
    main()
