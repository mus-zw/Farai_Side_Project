
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
