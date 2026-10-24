'use client';

// src/components/corridors/corridor-editor-map-inner.tsx
// Full-screen interactive map for defining corridor boundaries by clicking points.

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, ArrowUUpLeft, Trash, Check, MapPin, Crosshair, CircleNotch } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { ServiceAreaItem } from '@/types/admin';

interface CorridorEditorMapInnerProps {
  existingCorridors: ServiceAreaItem[];
  points: [number, number][]; // [lat, lng][]
  onAddPoint: (point: [number, number]) => void;
  onUpdatePoint?: (index: number, newPoint: [number, number]) => void;
  onDeletePoint?: (index: number) => void;
  onUndoPoint: () => void;
  onClearPoints: () => void;
  onNext: () => void;
  onCancel: () => void;
  initialCenter?: [number, number];
}

const DEFAULT_CENTER: [number, number] = [8.4799, 4.5418]; // Ilorin / Central Nigeria

export default function CorridorEditorMapInner({
  existingCorridors,
  points,
  onAddPoint,
  onUpdatePoint,
  onDeletePoint,
  onUndoPoint,
  onClearPoints,
  onNext,
  onCancel,
  initialCenter = DEFAULT_CENTER,
}: CorridorEditorMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawingLayerRef = useRef<L.LayerGroup | null>(null);
  const polyLayerRef = useRef<L.Polygon | L.Polyline | null>(null);
  const existingLayerRef = useRef<L.LayerGroup | null>(null);
  const meLayerRef = useRef<L.LayerGroup | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Center the map on the admin's current position (browser geolocation).
  const locateMe = () => {
    const map = mapInstanceRef.current;
    if (!map || locating) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('This browser cannot share your location.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const here: [number, number] = [position.coords.latitude, position.coords.longitude];
        if (!meLayerRef.current) meLayerRef.current = L.layerGroup().addTo(map);
        meLayerRef.current.clearLayers();
        L.circle(here, {
          radius: Math.max(position.coords.accuracy, 15),
          color: '#2563eb',
          weight: 1,
          fillColor: '#2563eb',
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(meLayerRef.current);
        L.circleMarker(here, {
          radius: 7,
          color: '#ffffff',
          weight: 3,
          fillColor: '#2563eb',
          fillOpacity: 1,
          interactive: false,
        }).addTo(meLayerRef.current);
        map.flyTo(here, Math.max(map.getZoom(), 15), { duration: 0.8 });
      },
      (error) => {
        setLocating(false);
        setLocateError(
          error.code === error.PERMISSION_DENIED
            ? 'Location is blocked for this site. Allow it in the browser address bar.'
            : error.code === error.TIMEOUT
              ? 'Finding your location took too long. Try again.'
              : 'Your location is unavailable right now.',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: points.length > 0 ? points[0] : initialCenter,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const existingLayer = L.layerGroup().addTo(map);
    const drawingLayer = L.layerGroup().addTo(map);
    existingLayerRef.current = existingLayer;
    drawingLayerRef.current = drawingLayer;
    mapInstanceRef.current = map;

    // Handle map click to add point
    map.on('click', (e: L.LeafletMouseEvent) => {
      onAddPoint([Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render Existing Corridors in background (faint reference)
  useEffect(() => {
    const layer = existingLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    existingCorridors.forEach((c) => {
      if (!c.geometry || !c.geometry.coordinates) return;
      const geoJsonFeature: any = {
        type: 'Feature',
        properties: { name: c.name, status: c.status },
        geometry: c.geometry,
      };

      L.geoJSON(geoJsonFeature, {
        style: {
          color: c.status === 'ACTIVE' ? '#10b981' : '#f59e0b',
          weight: 1.5,
          dashArray: '4, 4',
          fillColor: c.status === 'ACTIVE' ? '#10b981' : '#f59e0b',
          fillOpacity: 0.08,
        },
      })
        .bindTooltip(`Existing: ${c.name}`, { sticky: true, opacity: 0.85 })
        .addTo(layer);
    });
  }, [existingCorridors]);

  // Helper to redraw polygon / polyline connecting current coords
  const redrawShape = (coords: [number, number][]) => {
    const map = mapInstanceRef.current;
    const layer = drawingLayerRef.current;
    if (!map || !layer) return;

    if (polyLayerRef.current) {
      layer.removeLayer(polyLayerRef.current);
      polyLayerRef.current = null;
    }

    if (coords.length >= 3) {
      const poly = L.polygon(coords, {
        color: '#bb9348',
        weight: 2.5,
        fillColor: '#bb9348',
        fillOpacity: 0.28,
        dashArray: '3, 3',
      }).addTo(layer);
      polyLayerRef.current = poly;
    } else if (coords.length === 2) {
      const line = L.polyline(coords, {
        color: '#bb9348',
        weight: 2.5,
        dashArray: '4, 4',
      }).addTo(layer);
      polyLayerRef.current = line;
    }
  };

  // Render Currently Drawn Boundary & Interactive Markers
  useEffect(() => {
    const layer = drawingLayerRef.current;
    const map = mapInstanceRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    polyLayerRef.current = null;

    if (points.length === 0) return;

    // Draw initial polygon or polyline connecting the points
    redrawShape(points);

    // Keep track of live dragged coordinates
    const liveCoords: [number, number][] = [...points];

    // Draw interactive markers for each point
    points.forEach((pt, index) => {
      const isFirst = index === 0;
      const markerHtml = `
        <div style="
          background: ${isFirst ? '#bb9348' : '#3b82f6'};
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          border: 2px solid white;
          cursor: grab;
          user-select: none;
        ">
          ${index + 1}
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-point-pin',
        html: markerHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker(pt, {
        icon,
        draggable: true,
        autoPan: true,
      }).addTo(layer);

      // Prevent map click from adding a duplicate node when clicking/dragging a marker
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
      });

      // Update shape in real time as marker is dragged
      marker.on('drag', (e) => {
        const latlng = (e.target as L.Marker).getLatLng();
        liveCoords[index] = [latlng.lat, latlng.lng];
        redrawShape(liveCoords);
      });

      // Commit repositioned point on dragend
      marker.on('dragend', (e) => {
        const latlng = (e.target as L.Marker).getLatLng();
        const updatedPt: [number, number] = [
          Number(latlng.lat.toFixed(6)),
          Number(latlng.lng.toFixed(6)),
        ];
        onUpdatePoint?.(index, updatedPt);
      });

      // Popup to inspect, reposition, or delete node
      const popupDiv = document.createElement('div');
      popupDiv.style.textAlign = 'center';
      popupDiv.style.padding = '4px 6px';
      popupDiv.style.fontFamily = 'system-ui, sans-serif';
      popupDiv.innerHTML = `
        <div style="font-size: 12px; font-weight: 700; color: #111827; margin-bottom: 2px;">
          Point #${index + 1}
        </div>
        <div style="font-size: 10px; color: #6b7280; font-family: monospace; margin-bottom: 8px;">
          ${pt[0].toFixed(5)}, ${pt[1].toFixed(5)}
        </div>
        <div style="display: flex; gap: 6px; justify-content: center;">
          <button id="del-node-${index}" style="
            background: #ef4444; color: white; border: none; border-radius: 8px;
            padding: 5px 12px; font-size: 11px; font-weight: 600; cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          ">Delete Point</button>
        </div>
        <div style="font-size: 9px; color: #9ca3af; margin-top: 6px;">
          Drag to reposition | Right-click to delete
        </div>
      `;

      marker.bindPopup(popupDiv, { minWidth: 150 });
      marker.on('popupopen', () => {
        const delBtn = document.getElementById(`del-node-${index}`);
        if (delBtn) {
          delBtn.onclick = (btnEv) => {
            btnEv.stopPropagation();
            map.closePopup();
            onDeletePoint?.(index);
          };
        }
      });

      // Right-click to immediately delete node
      marker.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        onDeletePoint?.(index);
      });
    });
  }, [points]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background select-none">
      {/* Top Floating Control Bar */}
      <div className="flex flex-col gap-3 bg-overlay/95 px-6 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AppButton
            variant="ghost"
            size="sm"
            startContent={<ArrowLeft size={16} />}
            onPress={onCancel}
            label="Cancel"
          />
          <div className="h-5 w-px bg-border hidden sm:block" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">Mark Operating Corridor Boundary</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  points.length >= 3
                    ? 'bg-success/15 text-success'
                    : 'bg-warning-soft text-warning'
                }`}
              >
                {points.length} {points.length === 1 ? 'point' : 'points'} marked (Min: 3)
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Click map to add nodes. Drag any point to reposition. Click or right-click to delete.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {points.length > 0 && (
            <>
              <AppButton
                variant="ghost"
                size="sm"
                startContent={<ArrowUUpLeft size={14} />}
                onPress={onUndoPoint}
                label="Undo Point"
              />
              <AppButton
                variant="ghost"
                size="sm"
                startContent={<Trash size={14} className="text-danger" />}
                onPress={onClearPoints}
                label="Clear All"
              />
            </>
          )}

          <AppButton
            variant="brand"
            size="sm"
            isDisabled={points.length < 3}
            onPress={onNext}
            startContent={<Check size={16} weight="bold" />}
            label="Next: Configure Details"
          />
        </div>
      </div>

      {/* Map Viewport */}
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Center on my location */}
        <div className="absolute right-3 top-3 z-[400] flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="grid size-10 cursor-pointer place-items-center rounded-xl bg-overlay text-foreground shadow-md hover:bg-surface-secondary disabled:cursor-wait"
            aria-label="Center on my location"
            title="Center on my location"
          >
            {locating ? <CircleNotch size={18} className="animate-spin" /> : <Crosshair size={18} weight="bold" />}
          </button>
          {locateError && (
            <div className="max-w-[240px] rounded-xl bg-overlay px-3 py-2 text-[12px] text-foreground shadow-md">
              {locateError}
              <button type="button" onClick={() => setLocateError(null)} className="ml-2 cursor-pointer text-muted hover:text-foreground">
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Floating Helper Toast at bottom */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-2 rounded-2xl bg-overlay/90 px-4 py-2 backdrop-blur-md text-xs text-foreground font-medium">
          <MapPin size={16} className="text-secondary" weight="duotone" />
          <span>
            {points.length === 0
              ? 'Click anywhere on the map to place your first boundary node'
              : points.length < 3
              ? `Click ${3 - points.length} more ${3 - points.length === 1 ? 'point' : 'points'} to close the geofence boundary`
              : 'Boundary enclosed! Drag points to adjust, click a point to delete, or click "Next"'}
          </span>
        </div>
      </div>
    </div>
  );
}
