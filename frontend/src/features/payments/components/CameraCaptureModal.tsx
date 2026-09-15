import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  X,
  RefreshCw,
  Check,
  RotateCcw,
  AlertCircle,
  Loader2,
  Smartphone,
} from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onFallbackNativeCamera?: () => void;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  onFallbackNativeCamera,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoading, setIsLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  // Start or switch camera stream
  useEffect(() => {
    if (!isOpen || capturedImage) return;

    let activeStream: MediaStream | null = null;
    setIsLoading(true);
    setCameraError(null);

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera stream is not supported on this browser or connection. Please use the device camera.');
        }

        // Request environment (back camera for tablet document scanning)
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setIsLoading(false);
          };
        }
      } catch (err: any) {
        setIsLoading(false);
        const isPermissionDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
        setCameraError(
          isPermissionDenied
            ? 'Camera access was denied. Please allow camera permissions in browser settings or use the system camera.'
            : err.message || 'Unable to access tablet camera.'
        );
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode, capturedImage]);

  // Stop camera when closing
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
    setCapturedBlob(null);
    setCameraError(null);
    onClose();
  };

  // Flip between front and rear camera
  const handleFlipCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture frame from live video
  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw full video frame
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
        }
      },
      'image/jpeg',
      0.92
    );

    // Stop video tracks while reviewing snapshot
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    // Setting capturedImage to null will trigger the camera start effect
  };

  // Confirm and pass captured file to parent
  const handleConfirmCapture = () => {
    if (!capturedBlob) return;
    const filename = `proof-${Date.now()}.jpg`;
    const file = new File([capturedBlob], filename, { type: 'image/jpeg' });
    handleClose();
    onCapture(file);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[140] flex h-[100dvh] w-screen items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm select-none animate-in fade-in-0 duration-150 sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-xl bg-slate-900 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-700/80 text-white flex items-center justify-center shadow-xs">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                {capturedImage ? 'Review Document Photo' : 'Tablet Camera Scanner'}
              </h3>
              <p className="text-[11px] text-slate-400 font-normal">
                {capturedImage
                  ? 'Verify text & numbers are legible before attaching'
                  : 'Position receipt, cheque, or slip within frame'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!capturedImage && !cameraError && (
              <button
                type="button"
                onClick={handleFlipCamera}
                className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Switch Camera (Front/Rear)"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Viewfinder / Captured Photo Display */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] sm:min-h-[380px] overflow-hidden">
          {capturedImage ? (
            /* Review captured picture */
            <div className="relative w-full h-full flex items-center justify-center p-2">
              <img
                src={capturedImage}
                alt="Captured payment proof"
                className="max-h-[50vh] sm:max-h-[55vh] w-auto max-w-full rounded-xl object-contain shadow-xl"
              />
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                Photo Captured
              </div>
            </div>
          ) : cameraError ? (
            /* Camera access failure / Fallback */
            <div className="p-6 text-center max-w-md space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-200">Unable to Start Camera Stream</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>
              </div>

              {onFallbackNativeCamera && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onFallbackNativeCamera();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs transition flex items-center justify-center gap-2 mx-auto cursor-pointer shadow-sm"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open Tablet Camera App</span>
                </button>
              )}
            </div>
          ) : (
            /* Live Camera Stream */
            <div className="relative w-full h-full flex items-center justify-center">
              {isLoading && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 z-10">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  <span className="text-xs text-slate-400">Initializing tablet camera...</span>
                </div>
              )}

              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover max-h-[55vh]"
              />

              {/* Document Framing Guidelines Overlay */}
              {!isLoading && (
                <div className="absolute inset-6 sm:inset-8 border-2 border-dashed border-emerald-400/50 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                    <div className="w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  </div>
                  <div className="text-center">
                    <span className="bg-black/60 backdrop-blur-xs text-[10.5px] text-emerald-300 font-semibold px-3 py-1 rounded-full border border-emerald-400/20">
                      Align receipt / slip inside frame
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                    <div className="w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hidden Canvas for snapshot conversion */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Action Controls Footer */}
        <div className="p-4 px-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          {capturedImage ? (
            /* Review Actions */
            <div className="flex items-center justify-between w-full gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmCapture}
                className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-700 hover:bg-emerald-600 transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Use This Photo</span>
              </button>
            </div>
          ) : !cameraError ? (
            /* Live Capture Shutter */
            <div className="flex items-center justify-between w-full">
              {onFallbackNativeCamera && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onFallbackNativeCamera();
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                  title="Use native tablet camera application"
                >
                  <Smartphone className="w-4 h-4 text-slate-400" />
                  <span>Device Camera</span>
                </button>
              )}

              {/* Shutter Button */}
              <div className="mx-auto">
                <button
                  type="button"
                  onClick={handleTakeSnapshot}
                  disabled={isLoading}
                  className="h-16 w-16 rounded-full border-4 border-white/80 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center transition shadow-lg cursor-pointer disabled:opacity-50"
                  aria-label="Capture snapshot"
                >
                  <div className="h-12 w-12 rounded-full border-2 border-white/40 bg-emerald-700 flex items-center justify-center">
                    <Camera className="w-6 h-6" />
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="w-full text-center">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
