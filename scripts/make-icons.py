"""Generate placeholder extension icons (blue rounded square with a check mark).
Replace public/icon/*.png with your brand icon before publishing."""
import sys
from PIL import Image, ImageDraw

out = sys.argv[1]
for size in (16, 32, 48, 96, 128):
    s = size * 4  # draw large, downsample for smooth edges
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s // 5, fill=(31, 95, 209, 255))
    w = max(2, s // 9)
    d.line([(s * 0.26, s * 0.52), (s * 0.43, s * 0.69), (s * 0.75, s * 0.33)],
           fill=(255, 255, 255, 255), width=w, joint="curve")
    img.resize((size, size), Image.LANCZOS).save(f"{out}/{size}.png")
print("icons written to", out)
