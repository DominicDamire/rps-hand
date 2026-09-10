"""Rock-Paper-Scissors hand tracker.

Left half: your webcam (mirrored). Right half: a 3D hand that copies every finger joint live.
Keys: SPACE = play a round against the computer, ESC = quit.
CLI: --source <video|image path> (default webcam 0), --shot <png> (headless self-check: save a frame and exit).
"""
import os
import sys
import time
import random
import ctypes

os.environ.setdefault("GLOG_minloglevel", "2")
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")

import numpy as np
import cv2
import pygame
from OpenGL.GL import *
from OpenGL.GLU import *
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

W, H = 1280, 720
HALF = W // 2
SKIN = (0.87, 0.68, 0.56)      # flat colour "skin"; swap for a textured mesh when skins are wanted
GHOST = (0.45, 0.47, 0.52)     # shown when no hand is in view (last pose, greyed out)

# MediaPipe 21-point hand skeleton: joint -> parent, and a fixed bone length (metres) per joint.
# Lengths are canonical so every player's hand renders the same size; only the motion is copied.
PARENT = {1: 0, 2: 1, 3: 2, 4: 3, 5: 0, 6: 5, 7: 6, 8: 7, 9: 0, 10: 9, 11: 10, 12: 11,
          13: 0, 14: 13, 15: 14, 16: 15, 17: 0, 18: 17, 19: 18, 20: 19}
LENGTH = {1: .040, 2: .035, 3: .030, 4: .025, 5: .092, 6: .040, 7: .025, 8: .022, 9: .088, 10: .045, 11: .028, 12: .022,
          13: .082, 14: .040, 15: .026, 16: .022, 17: .076, 18: .032, 19: .020, 20: .020}
PALM = [0, 5, 9, 13, 17]
PALM_EDGES = [(5, 9), (9, 13), (13, 17)]
MOVE_OF_GESTURE = {"Closed_Fist": "ROCK", "Open_Palm": "PAPER", "Victory": "SCISSORS"}
BEATS = {"ROCK": "SCISSORS", "PAPER": "ROCK", "SCISSORS": "PAPER"}

QUAD = None  # GLU quadric, created after the GL context exists


def asset(name):
    return os.path.join(getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__))), "assets", name)


def to_gl(landmarks):
    """MediaPipe world landmarks (x right, y down, z away from camera) -> GL (y up, z toward viewer)."""
    return np.array([(l.x, -l.y, -l.z) for l in landmarks], dtype=np.float32)


def retarget(pts):
    """Keep each bone's direction, replace its length with the canonical one, centre the palm at the origin."""
    out = np.zeros_like(pts)
    for j in range(1, 21):
        p = PARENT[j]
        d = pts[j] - pts[p]
        out[j] = out[p] + d / (np.linalg.norm(d) + 1e-9) * LENGTH[j]
    return out - out[PALM].mean(axis=0)


def move_from_landmarks(pts):
    """Orientation-free fallback when the canned classifier is unsure: count extended fingers.
    A finger is extended when its tip is further from the wrist than its middle joint."""
    wrist = pts[0]
    ext = tuple(bool(np.linalg.norm(pts[tip] - wrist) > np.linalg.norm(pts[pip] - wrist))
                for tip, pip in ((8, 6), (12, 10), (16, 14), (20, 18)))
    n = sum(ext)
    if n == 0:
        return "ROCK"
    if n == 4:
        return "PAPER"
    if ext == (True, True, False, False):
        return "SCISSORS"
    return None


class Game:
    def __init__(self):
        self.phase, self.t0, self.you, self.cpu, self.score = "idle", 0.0, None, None, [0, 0]

    def start(self, now):
        if self.phase == "idle":
            self.phase, self.t0 = "count", now

    def update(self, now, move):
        if self.phase == "count" and now - self.t0 >= 3:
            self.you, self.cpu, self.phase, self.t0 = move, random.choice(list(BEATS)), "result", now
            if self.you and BEATS[self.you] == self.cpu:
                self.score[0] += 1
            elif self.you and BEATS[self.cpu] == self.you:
                self.score[1] += 1
        elif self.phase == "result" and now - self.t0 >= 3:
            self.phase = "idle"

    def lines(self, now):
        if self.phase == "count":
            return [f"SHOOT IN {3 - int(now - self.t0)}"]
        if self.phase == "result":
            if not self.you:
                verdict = "NO MOVE SEEN"
            elif self.you == self.cpu:
                verdict = "DRAW"
            elif BEATS[self.you] == self.cpu:
                verdict = "YOU WIN"
            else:
                verdict = "CPU WINS"
            return [f"YOU {self.you or '?'}  vs  CPU {self.cpu}", verdict]
        return ["SPACE = play a round"]


def capsule(a, b, r):
    d = b - a
    length = float(np.linalg.norm(d))
    if length < 1e-6:
        return
    d = d / length
    glPushMatrix()
    glTranslatef(*a)
    axis = np.cross((0.0, 0.0, 1.0), d)  # rotate the quadric's +z onto the bone direction
    s = float(np.linalg.norm(axis))
    if s > 1e-6:
        glRotatef(float(np.degrees(np.arctan2(s, d[2]))), *axis)
    elif d[2] < 0:
        glRotatef(180, 1, 0, 0)
    gluSphere(QUAD, r, 14, 10)
    gluCylinder(QUAD, r, r, length, 14, 1)
    glTranslatef(0, 0, length)
    gluSphere(QUAD, r, 14, 10)
    glPopMatrix()


def draw_hand(pts, color):
    glColor3f(*color)
    for j, p in PARENT.items():
        capsule(pts[p], pts[j], 0.011 if j <= 4 else 0.014 if p == 0 else 0.009)
    for a, b in PALM_EDGES:
        capsule(pts[a], pts[b], 0.014)
    # palm slab: the 5-point palm polygon drawn twice, offset along its normal, so it has thickness
    n = np.cross(pts[5] - pts[0], pts[17] - pts[0])
    n = n / (np.linalg.norm(n) + 1e-9)
    for side in (1, -1):
        glNormal3f(*(n * side))
        glBegin(GL_POLYGON)
        for i in (PALM if side == 1 else PALM[::-1]):
            glVertex3f(*(pts[i] + n * side * 0.007))
        glEnd()
    fore = pts[0] - pts[9]
    fore = fore / (np.linalg.norm(fore) + 1e-9)
    capsule(pts[0], pts[0] + fore * 0.16, 0.024)


def put(img, text, y, scale=0.9, color=(255, 255, 255)):
    cv2.putText(img, text, (16, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), 5, cv2.LINE_AA)
    cv2.putText(img, text, (16, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, 2, cv2.LINE_AA)


def init_gl():
    global QUAD
    QUAD = gluNewQuadric()
    gluQuadricNormals(QUAD, GLU_SMOOTH)
    glEnable(GL_NORMALIZE)
    glEnable(GL_COLOR_MATERIAL)
    glColorMaterial(GL_FRONT_AND_BACK, GL_AMBIENT_AND_DIFFUSE)
    glLightModeli(GL_LIGHT_MODEL_TWO_SIDE, GL_TRUE)
    glEnable(GL_LIGHT0)
    glLightfv(GL_LIGHT0, GL_POSITION, (0.4, 0.8, 1.0, 0.0))
    glLightfv(GL_LIGHT0, GL_DIFFUSE, (1.0, 0.97, 0.92, 1.0))
    glLightfv(GL_LIGHT0, GL_AMBIENT, (0.25, 0.25, 0.30, 1.0))
    glEnable(GL_LIGHT1)
    glLightfv(GL_LIGHT1, GL_POSITION, (-0.8, -0.3, 0.5, 0.0))
    glLightfv(GL_LIGHT1, GL_DIFFUSE, (0.30, 0.35, 0.50, 1.0))
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1)
    tex = glGenTextures(1)
    glBindTexture(GL_TEXTURE_2D, tex)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)


def draw_camera(rgb):
    glViewport(0, 0, HALF, H)
    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    gluOrtho2D(0, HALF, H, 0)
    glMatrixMode(GL_MODELVIEW)
    glLoadIdentity()
    glDisable(GL_LIGHTING)
    glDisable(GL_DEPTH_TEST)
    glEnable(GL_TEXTURE_2D)
    glColor3f(1, 1, 1)
    fh, fw = rgb.shape[:2]
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, fw, fh, 0, GL_RGB, GL_UNSIGNED_BYTE, np.ascontiguousarray(rgb))
    s = min(HALF / fw, H / fh)
    dw, dh = fw * s, fh * s
    x0, y0 = (HALF - dw) / 2, (H - dh) / 2
    glBegin(GL_QUADS)
    glTexCoord2f(0, 0); glVertex2f(x0, y0)
    glTexCoord2f(1, 0); glVertex2f(x0 + dw, y0)
    glTexCoord2f(1, 1); glVertex2f(x0 + dw, y0 + dh)
    glTexCoord2f(0, 1); glVertex2f(x0, y0 + dh)
    glEnd()
    glDisable(GL_TEXTURE_2D)


def draw_replica(pose, visible):
    glViewport(HALF, 0, HALF, H)
    glEnable(GL_SCISSOR_TEST)
    glScissor(HALF, 0, HALF, H)
    glClearColor(0.11, 0.13, 0.18, 1)
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    glDisable(GL_SCISSOR_TEST)
    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    gluPerspective(40, HALF / H, 0.05, 5)
    glMatrixMode(GL_MODELVIEW)
    glLoadIdentity()
    gluLookAt(0.13, 0.11, 0.50, 0, -0.02, 0, 0, 1, 0)
    glEnable(GL_LIGHTING)
    glEnable(GL_DEPTH_TEST)
    if pose is not None:
        draw_hand(pose, SKIN if visible else GHOST)


def main(argv):
    src = argv[argv.index("--source") + 1] if "--source" in argv else "0"
    src = int(src) if src.isdigit() else src  # "0", "1" -> camera index; anything else -> file path
    shot = argv[argv.index("--shot") + 1] if "--shot" in argv else None
    still = cv2.imread(src) if isinstance(src, str) and src.lower().endswith((".jpg", ".jpeg", ".png")) else None
    cap = None
    if still is None:
        cap = cv2.VideoCapture(src, cv2.CAP_DSHOW) if isinstance(src, int) else cv2.VideoCapture(src)

    rec = vision.GestureRecognizer.create_from_options(vision.GestureRecognizerOptions(
        base_options=BaseOptions(model_asset_path=asset("gesture_recognizer.task")),
        running_mode=vision.RunningMode.VIDEO, num_hands=1))

    pygame.init()
    pygame.display.set_mode((W, H), pygame.DOUBLEBUF | pygame.OPENGL)
    pygame.display.set_caption("Rock Paper Scissors - Hand Tracker")
    init_gl()

    game, clock = Game(), pygame.time.Clock()
    pose, visible, move, label, ts, frames = None, False, None, "-", 0, 0
    rgb = np.zeros((480, 640, 3), np.uint8)
    try:
        while True:
            now = time.monotonic()
            for e in pygame.event.get():
                if e.type == pygame.QUIT or (e.type == pygame.KEYDOWN and e.key == pygame.K_ESCAPE):
                    return
                if e.type == pygame.KEYDOWN and e.key == pygame.K_SPACE:
                    game.start(now)

            if still is not None:
                ok, new = True, still
            else:
                ok, new = cap.read() if cap.isOpened() else (False, None)
            if ok:
                # Mirror first: selfie view for the player, and MediaPipe's handedness assumes a mirrored image.
                rgb = cv2.cvtColor(cv2.flip(new, 1), cv2.COLOR_BGR2RGB)
                ts = max(ts + 1, int(now * 1000))  # VIDEO mode needs strictly increasing timestamps
                res = rec.recognize_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), ts)
                visible = bool(res.hand_world_landmarks)
                if visible:
                    target = retarget(to_gl(res.hand_world_landmarks[0]))
                    pose = target if pose is None else 0.55 * target + 0.45 * pose  # light jitter smoothing
                    label = res.gestures[0][0].category_name if res.gestures and res.gestures[0] else "-"
                    move = MOVE_OF_GESTURE.get(label) or move_from_landmarks(pose)
                else:
                    label, move = "-", None
            else:
                rgb = np.zeros((480, 640, 3), np.uint8)
                visible, label, move = False, "-", None
                put(rgb, "NO CAMERA", 240, 1.4, (255, 80, 80))

            game.update(now, move)
            put(rgb, f"GESTURE: {label}", 40, 0.8, (200, 220, 255))
            put(rgb, f"MOVE: {move or '?'}", 80, 1.1, (120, 255, 120) if move else (255, 200, 80))
            y = rgb.shape[0] - 20
            for line in reversed(game.lines(now)):
                put(rgb, line, y, 1.0, (255, 230, 120))
                y -= 44
            put(rgb, f"SCORE  you {game.score[0]} : {game.score[1]} cpu", y, 0.8)

            glClearColor(0.06, 0.07, 0.09, 1)
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
            draw_camera(rgb)
            draw_replica(pose, visible)

            frames += 1
            if shot and frames >= 45:
                buf = glReadPixels(0, 0, W, H, GL_RGB, GL_UNSIGNED_BYTE)
                img = np.frombuffer(buf, np.uint8).reshape(H, W, 3)[::-1]
                cv2.imwrite(shot, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
                with open(shot + ".txt", "w") as f:  # sidecar: a --windowed exe has no stdout
                    f.write(f"gesture={label} move={move}\n")
                return
            pygame.display.flip()
            clock.tick(60)
    finally:
        if cap is not None:
            cap.release()
        rec.close()
        pygame.quit()


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except Exception:
        import traceback
        err = traceback.format_exc()
        base = os.path.dirname(sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__))
        try:
            with open(os.path.join(base, "rps_hand_error.log"), "w") as f:
                f.write(err)
        except OSError:
            pass
        if getattr(sys, "frozen", False):
            ctypes.windll.user32.MessageBoxW(0, err[-1500:], "RPS Hand crashed", 0x10)
        raise
