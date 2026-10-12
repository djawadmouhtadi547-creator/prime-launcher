import { useEffect, useRef } from 'react';
import { SkinViewer as Viewer, WalkingAnimation } from 'skinview3d';
import { defaultSkinDataUrl } from '../services/skins.js';

// عرض ثلاثي الأبعاد للسكن. skin = رابط أو data URL، وإذا فشل التحميل يظهر السكن الافتراضي.
export default function SkinViewer({ skin, width = 260, height = 340 }) {
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    const viewer = new Viewer({
      canvas: canvasRef.current,
      width,
      height,
      zoom: 0.8,
    });
    viewer.animation = new WalkingAnimation();
    viewer.animation.speed = 0.55;
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.5;
    viewer.controls.enableZoom = false;
    viewer.controls.enablePan = false;
    viewerRef.current = viewer;
    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const fallback = () => viewer.loadSkin(defaultSkinDataUrl());
    if (!skin) {
      fallback();
      return;
    }
    Promise.resolve(viewer.loadSkin(skin)).catch(() => fallback());
  }, [skin, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="block" />;
}
