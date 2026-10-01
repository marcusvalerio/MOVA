"""Pipeline de demonstração: vídeo → YOLO → ByteTrack → contagem por linha virtual → CameraObservation.

Uso:
    python -m mova_cv.pipeline demo/config.json --out demo/out

Saídas (em --out):
    events.csv           um registro por cruzamento (track, classe, confiança, quadro, tempo, linha, sentido)
    observations.json    CameraObservation por linha+sentido para o clipe inteiro (formato do adaptador MOVA)
    run.json             metadados da execução (modelo, parâmetros, contagens, limitações)
    annotated.mp4        vídeo anotado (H.264), derivado do vídeo original — mesma licença do original

Nada aqui interpreta a condição da via. Velocidade e fila não são estimadas: exigiriam calibração
métrica da cena (distâncias reais), que não existe para este vídeo.
"""
from __future__ import annotations

import argparse
import re
import csv
import json
import subprocess
import time
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import numpy as np

from .geometry import crossing
from .stabilize import Stabilizer, project

COLORS = {"carro": (219, 111, 47), "moto": (246, 92, 138), "onibus": (74, 201, 242), "caminhao": (32, 152, 221)}


def run(config_path: str, out_dir: str, max_frames: int | None = None) -> dict:
    cfg = json.loads(Path(config_path).read_text())
    base = Path(config_path).parent
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    from ultralytics import YOLO  # import tardio: os testes de geometria não exigem a biblioteca

    m = cfg["model"]
    classes = {int(k): v for k, v in m["classes"].items()}
    model = YOLO(m["weights"])
    video = _ensure_supported(base / cfg["camera"]["video"]["file"], out)
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS)
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()

    raw_path = out / "annotated_raw.mp4"
    writer = cv2.VideoWriter(str(raw_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    lines = cfg["lines"]
    last_pt: dict[int, tuple[float, float]] = {}
    track_cls: dict[int, Counter] = defaultdict(Counter)
    track_conf: dict[int, list[float]] = defaultdict(list)
    counted: set[tuple[int, str]] = set()
    events: list[dict] = []
    flash: dict[str, int] = {}
    t0 = time.time()

    stream = model.track(source=str(video), stream=True, persist=True, tracker=m["tracker"], imgsz=m["imgsz"],
                         conf=m["conf"], classes=list(classes), verbose=False)
    stab_cfg = cfg.get("stabilization", {"enabled": False})
    stab = None
    stab_log: list[dict] = []
    stopped_reason = "fim do vídeo"
    frame_idx = -1
    for res in stream:
        frame_idx += 1
        if max_frames is not None and frame_idx >= max_frames:
            stopped_reason = "limite de quadros"
            break
        frame = res.orig_img.copy()
        H = None
        if stab_cfg.get("enabled"):
            if stab is None:
                stab = Stabilizer(frame, min_inliers=stab_cfg.get("minInliers", 300))
                H, inl, ok = np.eye(3), -1, True
            else:
                H, inl, ok = stab.homography(frame)
            stab_log.append({"quadro": frame_idx, "inliers": inl, "ok": ok})
            if ok and H is not None:
                Hi = np.linalg.inv(H)
                margin = 10
                for ln in lines:
                    for q in (ln["p1"], ln["p2"]):
                        x, y = project(Hi, tuple(q))
                        if not (margin <= x <= w - margin and margin <= y <= h - margin):
                            ok = False
                            stopped_reason = f"linha '{ln['id']}' saiu do enquadramento no quadro {frame_idx} (t={frame_idx / fps:.2f}s): contagem interrompida"
                if not ok:
                    frame_idx -= 1
                    break
            if not ok:
                stopped_reason = f"alinhamento perdido no quadro {frame_idx} (t={frame_idx / fps:.2f}s, inliers={inl}): a câmera mudou de cena"
                frame_idx -= 1
                break
        to_ref = (lambda p: project(H, p)) if H is not None else (lambda p: p)
        boxes = res.boxes
        if boxes is not None and boxes.id is not None:
            for xyxy, tid, c, cf in zip(boxes.xyxy.tolist(), boxes.id.int().tolist(), boxes.cls.int().tolist(), boxes.conf.tolist()):
                x1, y1, x2, y2 = xyxy
                pt = to_ref(((x1 + x2) / 2, (y1 + y2) / 2))
                track_cls[tid][classes[c]] += 1
                track_conf[tid].append(cf)
                if tid in last_pt:
                    for ln in lines:
                        if (tid, ln["id"]) in counted:
                            continue
                        s = crossing(tuple(ln["p1"]), tuple(ln["p2"]), last_pt[tid], pt)
                        if s:
                            counted.add((tid, ln["id"]))
                            cls_name = track_cls[tid].most_common(1)[0][0]
                            events.append({
                                "track": tid, "classe": cls_name, "confianca_media": round(sum(track_conf[tid]) / len(track_conf[tid]), 3),
                                "quadro": frame_idx, "tempo_s": round(frame_idx / fps, 2), "linha": ln["id"],
                                "sentido": ln["directions"]["positive" if s > 0 else "negative"],
                            })
                            flash[ln["id"]] = 6
                last_pt[tid] = pt
                name = track_cls[tid].most_common(1)[0][0]
                col = COLORS.get(name, (200, 200, 200))
                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), col, 1)
                cv2.putText(frame, f"{tid}", (int(x1), int(y1) - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.35, col, 1, cv2.LINE_AA)
        Hinv = np.linalg.inv(H) if H is not None else None
        for ln in lines:
            hot = flash.get(ln["id"], 0) > 0
            a, b = tuple(ln["p1"]), tuple(ln["p2"])
            if Hinv is not None:
                a, b = project(Hinv, a), project(Hinv, b)
            cv2.line(frame, (int(a[0]), int(a[1])), (int(b[0]), int(b[1])), (80, 220, 120) if hot else (255, 255, 255), 3 if hot else 2)
            flash[ln["id"]] = max(0, flash.get(ln["id"], 0) - 1)
        _hud(frame, lines, events, frame_idx / fps)
        writer.write(frame)
    writer.release()
    elapsed = time.time() - t0
    duration = (frame_idx + 1) / fps

    _write_events(out / "events.csv", events)
    observations = _observations(cfg, lines, events, duration)
    (out / "observations.json").write_text(json.dumps(observations, ensure_ascii=False, indent=2))
    _to_h264(raw_path, out / "annotated.mp4")

    info = {
        "camera": cfg["camera"],
        "model": {**m, "ultralytics": __import__("ultralytics").__version__},
        "frames": frame_idx + 1, "fps": fps, "durationSeconds": round(duration, 3), "resolution": [w, h],
        "processingSeconds": round(elapsed, 1), "device": "cpu",
        "framesInVideo": n_frames, "stoppedReason": stopped_reason,
        "stabilization": {**stab_cfg, "minInliersObserved": min((x["inliers"] for x in stab_log if x["inliers"] >= 0), default=None)},
        "tracksTotal": len(track_cls), "crossings": len(events),
        "countsByLine": {f'{ln["id"]}|{d}': sum(1 for e in events if e["linha"] == ln["id"] and e["sentido"] == d)
                         for ln in lines for d in ln["directions"].values()},
        "limitations": [
            "Vídeo de demonstração com licença aberta (Tel Aviv); não é via do Rio nem câmera CIVITAS.",
            "Data/hora da gravação desconhecida: tipo de dia não determinável.",
            f"Clipe de {duration:.1f} s: extrapolar para veíc/h tem alta incerteza.",
            "Velocidade e fila não estimadas: sem calibração métrica da cena.",
            "Classificação por classe COCO (carro/moto/ônibus/caminhão) sujeita a erro (ex.: ônibus detectado como caminhão).",
            "Veículos ocultos (atrás de outros ou sob o viaduto) podem não ser contados; trocas de ID podem duplicar.",
            "Nenhuma contagem manual de referência: precisão da contagem não medida.",
        ],
    }
    (out / "run.json").write_text(json.dumps(info, ensure_ascii=False, indent=2))
    return info


def _hud(frame, lines, events, t):
    cv2.rectangle(frame, (8, 8), (360, 30 + 18 * len(lines) * 2), (20, 20, 20), -1)
    cv2.putText(frame, f"MOVA CV demo  t={t:5.1f}s  (OBSERVADO)", (16, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
    y = 44
    for ln in lines:
        for d in ln["directions"].values():
            n = sum(1 for e in events if e["linha"] == ln["id"] and e["sentido"] == d)
            label = re.sub(r"\s*\(.*?\)", "", d).encode("ascii", "ignore").decode().strip()
            cv2.putText(frame, f"{ln['id']:<12} {label:<8} {n:>4}", (16, y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (230, 230, 230), 1, cv2.LINE_AA)
            y += 18


def _write_events(path: Path, events: list[dict]):
    with path.open("w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=["track", "classe", "confianca_media", "quadro", "tempo_s", "linha", "sentido"])
        wr.writeheader()
        wr.writerows(events)


def _observations(cfg, lines, events, duration):
    """Uma CameraObservation por linha+sentido cobrindo o clipe inteiro (contrato de src/adapters/camera.ts)."""
    obs = []
    for ln in lines:
        for d in ln["directions"].values():
            ev = [e for e in events if e["linha"] == ln["id"] and e["sentido"] == d]
            obs.append({
                "cameraId": f'{cfg["camera"]["cameraId"]}:{ln["id"]}',
                "timestamp": None,
                "intervalSeconds": round(duration, 3),
                "vehicleCount": len(ev),
                "vehicleTypes": dict(Counter(e["classe"] for e in ev)),
                "averageSpeed": None,
                "queueLength": None,
                "direction": d,
                "occupancy": None,
                "confidence": round(sum(e["confianca_media"] for e in ev) / len(ev), 3) if ev else 0,
                "source": f'{cfg["camera"]["source"]} · {cfg["model"]["weights"]} + {cfg["model"]["tracker"]}',
            })
    return obs


def _ensure_supported(video: Path, out: Path) -> Path:
    """A Ultralytics não lê .ogv: remultiplexa para .mkv sem recodificar (mesmos quadros)."""
    if video.suffix.lower() != ".ogv":
        return video
    import imageio_ffmpeg
    dst = out / (video.stem + ".mkv")
    if not dst.exists():
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(video), "-c", "copy", str(dst)], check=True)
    return dst


def _to_h264(src: Path, dst: Path):
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(src), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "28",
                    "-preset", "veryfast", "-movflags", "+faststart", str(dst)], check=True)
    # WebM (VP9) para navegadores sem H.264
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(dst), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1",
                    "-deadline", "good", "-cpu-used", "4", str(dst.with_suffix(".webm"))], check=True)
    src.unlink()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("config")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-frames", type=int)
    a = ap.parse_args()
    print(json.dumps(run(a.config, a.out, a.max_frames), ensure_ascii=False, indent=2))
