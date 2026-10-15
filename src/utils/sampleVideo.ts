import { VideoDetectionResponse, FrameDetection, VideoTrackedObject } from '../types';
import { getClassColor } from './colors';

/**
 * Generates an in-browser high-definition benchmark traffic video loop using HTML5 Canvas & MediaRecorder.
 * This ensures anyone testing the portfolio has an instant, realistic video with moving cars & pedestrians
 * without needing to download external video assets.
 */
export async function generateBenchmarkTrafficVideo(durationSec = 8, fps = 24): Promise<{ blob: Blob; url: string }> {
  return new Promise((resolve, reject) => {
    try {
      const width = 640;
      const height = 360;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 2D unavailable');
      }

      // Check MediaRecorder support
      const stream = canvas.captureStream(fps);
      let mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        resolve({ blob, url });
      };

      recorder.start();

      const totalFrames = durationSec * fps;
      let frameIndex = 0;

      const drawFrame = () => {
        if (frameIndex >= totalFrames) {
          recorder.stop();
          return;
        }

        const t = frameIndex / fps; // Current time in seconds

        // 1. Sky & City Background
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.45);
        skyGrad.addColorStop(0, '#38bdf8');
        skyGrad.addColorStop(1, '#bae6fd');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height * 0.45);

        // Buildings
        ctx.fillStyle = '#475569';
        ctx.fillRect(40, 60, 90, height * 0.45 - 60);
        ctx.fillRect(150, 40, 110, height * 0.45 - 40);
        ctx.fillRect(320, 70, 80, height * 0.45 - 70);
        ctx.fillRect(430, 30, 130, height * 0.45 - 30);

        // 2. Road & Intersection
        ctx.fillStyle = '#64748b'; // Sidewalk
        ctx.fillRect(0, height * 0.45, width, 30);

        ctx.fillStyle = '#1e293b'; // Road
        ctx.fillRect(0, height * 0.45 + 30, width, height - (height * 0.45 + 30));

        // Road lane dashed divider
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.setLineDash([20, 15]);
        ctx.beginPath();
        ctx.moveTo(0, height * 0.72);
        ctx.lineTo(width, height * 0.72);
        ctx.stroke();
        ctx.setLineDash([]);

        // Crosswalk stripes
        ctx.fillStyle = '#f8fafc';
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(80 + i * 40, height * 0.52, 22, height * 0.45);
        }

        // 3. Moving Object 1: Red Car driving west to east
        const car1X = -120 + ((t * 90) % (width + 240));
        const car1Y = height * 0.58;
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(car1X, car1Y, 110, 42, 8);
        ctx.fill();
        // Cabin
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.roundRect(car1X + 22, car1Y - 18, 60, 20, [6, 6, 0, 0]);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(car1X + 25, car1Y + 40, 11, 0, Math.PI * 2);
        ctx.arc(car1X + 85, car1Y + 40, 11, 0, Math.PI * 2);
        ctx.fill();

        // 4. Moving Object 2: Blue Car driving east to west in upper lane
        const car2X = width + 100 - ((t * 110) % (width + 220));
        const car2Y = height * 0.76;
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.roundRect(car2X, car2Y, 120, 44, 8);
        ctx.fill();
        ctx.fillStyle = '#0369a1';
        ctx.beginPath();
        ctx.roundRect(car2X + 30, car2Y - 18, 62, 20, [6, 6, 0, 0]);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(car2X + 28, car2Y + 42, 11, 0, Math.PI * 2);
        ctx.arc(car2X + 92, car2Y + 42, 11, 0, Math.PI * 2);
        ctx.fill();

        // 5. Moving Pedestrian 1: Walking across crosswalk north to south
        const ped1Y = height * 0.48 + ((t * 22) % (height * 0.42));
        ctx.fillStyle = '#fed7aa'; // head
        ctx.beginPath();
        ctx.arc(140, ped1Y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3b82f6'; // torso
        ctx.fillRect(135, ped1Y + 7, 10, 18);
        ctx.fillStyle = '#0f172a'; // legs
        ctx.fillRect(135, ped1Y + 25, 4, 16);
        ctx.fillRect(141, ped1Y + 25, 4, 16);

        // 6. Moving Pedestrian 2: Walking east on sidewalk
        const ped2X = ((t * 30) % width);
        ctx.fillStyle = '#fbcfe8';
        ctx.beginPath();
        ctx.arc(ped2X, height * 0.46, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(ped2X - 4, height * 0.46 + 6, 8, 14);

        // Frame number stamp
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(8, 8, 140, 24);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '11px monospace';
        ctx.fillText(`FARAI CV CAM ${t.toFixed(2)}s`, 14, 24);

        frameIndex++;
        // Render quickly using animation frame or immediate loop
        setTimeout(drawFrame, 1000 / fps);
      };

      drawFrame();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Computes realistic frame-by-frame detections for a given video duration and FPS.
 * Tracks object IDs across time and computes trajectory histories.
 */
export function generateSyntheticFrameDetections(durationSec: number, fps = 24): VideoDetectionResponse {
  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const frameDetections: FrameDetection[] = [];

  const classCounts: Record<string, number> = {
    car: 0,
    person: 0,
    truck: 0,
    'traffic light': 0,
  };

  const confidenceSums: Record<string, number> = {
    car: 0,
    person: 0,
    truck: 0,
    'traffic light': 0,
  };

  // Trajectory tracking stores
  const trajectoryCar1: [number, number][] = [];
  const trajectoryCar2: [number, number][] = [];
  const trajectoryPed1: [number, number][] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps;
    const boxes: VideoTrackedObject[] = [];

    // Car 1 (Track #101)
    const car1NormX = Math.max(0.02, Math.min(0.85, ((-100 + ((t * 90) % (640 + 200))) / 640)));
    const car1Center: [number, number] = [car1NormX + 0.08, 0.62];
    trajectoryCar1.push(car1Center);
    if (trajectoryCar1.length > 20) trajectoryCar1.shift();

    boxes.push({
      id: 'car-101',
      trackId: 101,
      className: 'car',
      confidence: 0.96,
      bbox: [car1NormX, 0.56, 0.18, 0.14],
      trajectory: [...trajectoryCar1],
      color: getClassColor('car').hex,
    });

    // Car 2 (Track #102)
    const car2NormX = Math.max(0.05, Math.min(0.86, (640 + 80 - ((t * 110) % (640 + 200))) / 640));
    const car2Center: [number, number] = [car2NormX + 0.09, 0.79];
    trajectoryCar2.push(car2Center);
    if (trajectoryCar2.length > 20) trajectoryCar2.shift();

    boxes.push({
      id: 'car-102',
      trackId: 102,
      className: 'car',
      confidence: 0.94,
      bbox: [car2NormX, 0.74, 0.19, 0.15],
      trajectory: [...trajectoryCar2],
      color: getClassColor('car').hex,
    });

    // Pedestrian 1 (Track #201, Crossing)
    const ped1NormY = 0.46 + ((t * 22) % 150) / 360;
    const ped1Center: [number, number] = [0.22, ped1NormY + 0.04];
    trajectoryPed1.push(ped1Center);
    if (trajectoryPed1.length > 18) trajectoryPed1.shift();

    boxes.push({
      id: 'ped-201',
      trackId: 201,
      className: 'person',
      confidence: 0.92,
      bbox: [0.20, ped1NormY, 0.04, 0.12],
      trajectory: [...trajectoryPed1],
      color: getClassColor('person').hex,
    });

    // Stationary Traffic Light (Track #301)
    boxes.push({
      id: 'tl-301',
      trackId: 301,
      className: 'traffic light',
      confidence: 0.98,
      bbox: [0.08, 0.22, 0.05, 0.18],
      color: getClassColor('traffic light').hex,
    });

    // Build frame detections breakdown
    const frameBreakdown: Record<string, { count: number; confidence_scores: number[] }> = {};
    boxes.forEach((b) => {
      if (!frameBreakdown[b.className]) {
        frameBreakdown[b.className] = { count: 0, confidence_scores: [] };
      }
      frameBreakdown[b.className].count += 1;
      frameBreakdown[b.className].confidence_scores.push(b.confidence);

      classCounts[b.className] = (classCounts[b.className] || 0) + 1;
      confidenceSums[b.className] = (confidenceSums[b.className] || 0) + b.confidence;
    });

    // Detect scene change flags every 120 frames
    const isSceneChange = f > 0 && f % 140 === 0;

    frameDetections.push({
      frame_number: f,
      timestamp: parseFloat(t.toFixed(3)),
      detections: frameBreakdown,
      boxes,
      sceneChange: isSceneChange,
    });
  }

  const avgConfidence: Record<string, number> = {};
  Object.keys(classCounts).forEach((cls) => {
    const total = classCounts[cls];
    avgConfidence[cls] = total > 0 ? parseFloat((confidenceSums[cls] / total).toFixed(2)) : 0;
  });

  return {
    total_frames: totalFrames,
    fps,
    duration_seconds: durationSec,
    frame_detections: frameDetections,
    summary: {
      total_objects: totalFrames * 4,
      unique_tracks: 4,
      object_count_per_class: classCounts,
      average_confidence_per_class: avgConfidence,
    },
    processing_time_ms: Math.round(durationSec * 140),
    source: 'client_engine',
  };
}
