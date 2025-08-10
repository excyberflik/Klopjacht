import React, { useEffect, useRef, useState } from 'react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: any) => void;
  onScanFailure?: (error: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onScanFailure, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setError('');
      
      // Check if we're on HTTPS or localhost (required for camera access)
      const isSecure = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        setHasPermission(false);
        setError('Camera access requires HTTPS. Please use the "Enter Manually" option below to input QR code data.');
        return;
      }
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasPermission(false);
        setError('Camera not supported in this browser. Please use the "Enter Manually" option below.');
        return;
      }
      
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        
        // Start scanning after video loads
        videoRef.current.onloadedmetadata = () => {
          startScanning();
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setHasPermission(false);
      
      let errorMessage = 'Camera access failed. ';
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera permissions and try again, or use "Enter Manually" below.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera found. Please use "Enter Manually" below.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage += 'Camera not supported. Please use "Enter Manually" below.';
      } else {
        errorMessage += 'Please use "Enter Manually" below to input QR code data.';
      }
      
      setError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const startScanning = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const scanInterval = setInterval(() => {
      if (!video.videoWidth || !video.videoHeight) return;

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Try to detect QR code using browser's built-in detector if available
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        detector.detect(imageData)
          .then((barcodes: any[]) => {
            if (barcodes.length > 0) {
              clearInterval(scanInterval);
              stopCamera();
              onScanSuccess(barcodes[0].rawValue, barcodes[0]);
            }
          })
          .catch((err: any) => {
            // Ignore detection errors, keep scanning
          });
      }
    }, 500); // Scan every 500ms to reduce CPU usage

    // Clean up interval after 30 seconds
    setTimeout(() => {
      clearInterval(scanInterval);
    }, 30000);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleManualInput = () => {
    const input = prompt(
      'Enter code manually:\n\n' +
      'You can enter either:\n' +
      '1. The 6-digit code from the admin dashboard (e.g., 123456)\n' +
      '2. The full JSON QR code data\n\n' +
      'Enter the code:'
    );
    if (input && input.trim()) {
      stopCamera();
      
      const trimmedInput = input.trim();
      
      // Check if it's a 6-digit code (manual entry from admin dashboard)
      if (/^\d{6}$/.test(trimmedInput)) {
        // Convert 6-digit code to a special format that the game page can recognize
        const manualCodeData = {
          type: 'manual_code',
          code: trimmedInput
        };
        onScanSuccess(JSON.stringify(manualCodeData), { rawValue: JSON.stringify(manualCodeData) });
      } else {
        // Assume it's full QR code JSON data
        onScanSuccess(trimmedInput, { rawValue: trimmedInput });
      }
    }
  };

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-modal">
        <div className="qr-scanner-header">
          <h2>🔍 Scan QR Code</h2>
          <button className="close-btn" onClick={handleClose}>
            ✕
          </button>
        </div>
        
        <div className="qr-scanner-content">
          {error ? (
            <div className="qr-scanner-error">
              <div className="error-icon">❌</div>
              <div className="error-message">{error}</div>
              <div className="error-actions">
                <button className="btn btn-primary" onClick={startCamera}>
                  Try Again
                </button>
                <button className="btn btn-secondary" onClick={handleManualInput}>
                  Enter Manually
                </button>
              </div>
            </div>
          ) : hasPermission === null ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Requesting camera permission...</p>
            </div>
          ) : (
            <>
              <div className="qr-scanner-instructions">
                <p>📱 Point your camera at a QR code</p>
                <p>Make sure the code is well-lit and clearly visible</p>
              </div>
              
              <div className="camera-container">
                <video 
                  ref={videoRef} 
                  className="camera-video"
                  playsInline
                  muted
                />
                <canvas 
                  ref={canvasRef} 
                  className="camera-canvas"
                  style={{ display: 'none' }}
                />
                
                {isScanning && (
                  <div className="scan-overlay">
                    <div className="scan-box">
                      <div className="scan-corners">
                        <div className="corner top-left"></div>
                        <div className="corner top-right"></div>
                        <div className="corner bottom-left"></div>
                        <div className="corner bottom-right"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {isScanning && (
                <div className="scanning-status">
                  <div className="scanning-animation"></div>
                  <p>🔍 Scanning for QR codes...</p>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="qr-scanner-footer">
          <button className="btn btn-secondary" onClick={handleManualInput}>
            Enter Manually
          </button>
          <button className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
        </div>
      </div>
      
      <style>{`
        .qr-scanner-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .qr-scanner-modal {
          background: white;
          border-radius: 12px;
          max-width: 500px;
          width: 95%;
          max-height: 95vh;
          overflow-y: auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        
        .qr-scanner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #eee;
          background: #f8f9fa;
          border-radius: 12px 12px 0 0;
        }
        
        .qr-scanner-header h2 {
          margin: 0;
          color: #333;
          font-size: 1.25rem;
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #666;
          padding: 0.25rem;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .close-btn:hover {
          background: rgba(0, 0, 0, 0.1);
        }
        
        .qr-scanner-content {
          padding: 1.5rem;
        }
        
        .qr-scanner-instructions {
          text-align: center;
          margin-bottom: 1rem;
          color: #666;
        }
        
        .qr-scanner-instructions p {
          margin: 0.5rem 0;
        }
        
        .camera-container {
          position: relative;
          width: 100%;
          max-width: 400px;
          margin: 0 auto;
          border-radius: 8px;
          overflow: hidden;
          background: #000;
        }
        
        .camera-video {
          width: 100%;
          height: auto;
          display: block;
        }
        
        .camera-canvas {
          position: absolute;
          top: 0;
          left: 0;
        }
        
        .scan-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .scan-box {
          width: 200px;
          height: 200px;
          position: relative;
        }
        
        .scan-corners {
          position: relative;
          width: 100%;
          height: 100%;
        }
        
        .corner {
          position: absolute;
          width: 20px;
          height: 20px;
          border: 3px solid #00ff00;
        }
        
        .corner.top-left {
          top: 0;
          left: 0;
          border-right: none;
          border-bottom: none;
        }
        
        .corner.top-right {
          top: 0;
          right: 0;
          border-left: none;
          border-bottom: none;
        }
        
        .corner.bottom-left {
          bottom: 0;
          left: 0;
          border-right: none;
          border-top: none;
        }
        
        .corner.bottom-right {
          bottom: 0;
          right: 0;
          border-left: none;
          border-top: none;
        }
        
        .scanning-status {
          text-align: center;
          margin-top: 1rem;
          color: #666;
        }
        
        .scanning-animation {
          width: 30px;
          height: 30px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 0.5rem;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-state {
          text-align: center;
          padding: 2rem;
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }
        
        .qr-scanner-error {
          text-align: center;
          padding: 2rem;
        }
        
        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        
        .error-message {
          font-size: 1.1rem;
          color: #dc3545;
          margin-bottom: 1.5rem;
          font-weight: 500;
        }
        
        .error-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .qr-scanner-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #eee;
          text-align: center;
          background: #f8f9fa;
          border-radius: 0 0 12px 12px;
          display: flex;
          gap: 1rem;
          justify-content: center;
        }
        
        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          transition: background-color 0.2s;
          min-width: 100px;
        }
        
        .btn-primary {
          background: #007bff;
          color: white;
        }
        
        .btn-primary:hover {
          background: #0056b3;
        }
        
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        
        .btn-secondary:hover {
          background: #5a6268;
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
