'use client';

// src/components/corridors/corridor-map-inner.tsx
// Leaflet interactive polygon renderer for Operating Corridors & Service Areas.

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ServiceAreaItem } from '@/types/admin';

interface CorridorMapInnerProps {
  corridors: ServiceAreaItem[];
  selectedCorridorId: string | null;
  onSelectCorridor: (id: string) => void;
}

// Default center over Nigeria (centered roughly between Ilorin & Lagos)
const NIGERIA_CENTER: [number, number] = [8.4799, 4.5418];

export default function CorridorMapInner({
  corridors,
  selectedCorridorId,
  onSelectCorridor,
}: CorridorMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonsLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: NIGERIA_CENTER,
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    const polygonsLayer = L.layerGroup().addTo(map);
    polygonsLayerRef.current = polygonsLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render Polygons when corridors or selection change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = polygonsLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const bounds = L.latLngBounds([]);
    let hasPolygons = false;

    corridors.forEach((area) => {
      if (!area.geometry || !area.geometry.coordinates) return;

      const isSelected = area.id === selectedCorridorId;
      const isActive = area.status === 'ACTIVE';

      // GeoJSON Feature
      const geojsonFeature: any = {
        type: 'Feature',
        properties: {
          id: area.id,
          name: area.name,
          policy: area.destinationPolicy,
          status: area.status,
        },
        geometry: area.geometry,
      };

      const strokeColor = isSelected ? '#bb9348' : isActive ? '#10b981' : '#f59e0b';
      const fillColor = isSelected ? '#bb9348' : isActive ? '#10b981' : '#f59e0b';

      const geoJsonLayer = L.geoJSON(geojsonFeature, {
        style: {
          color: strokeColor,
          weight: isSelected ? 3 : 2,
          opacity: 0.9,
          fillColor: fillColor,
          fillOpacity: isSelected ? 0.35 : 0.18,
          dashArray: isActive ? undefined : '5, 5',
        },
        onEachFeature: (feature, layer) => {
          layer.on({
            click: () => onSelectCorridor(area.id),
          });

          layer.bindTooltip(
            `<div class="p-1 font-sans">
              <div class="font-bold text-xs">${area.name}</div>
              <div class="text-[11px] text-gray-500">${area.destinationPolicy} &bull; ${area.status}</div>
            </div>`,
            { sticky: true, className: 'leaflet-custom-tooltip' },
          );
        },
      });

      geoJsonLayer.addTo(layerGroup);

      const layerBounds = geoJsonLayer.getBounds();
      if (layerBounds.isValid()) {
        bounds.extend(layerBounds);
        hasPolygons = true;
      }
    });

    // If a specific corridor is selected, zoom directly to its bounds
    if (selectedCorridorId) {
      const selectedArea = corridors.find((c) => c.id === selectedCorridorId);
      if (selectedArea?.geometry) {
        const selectedLayer = L.geoJSON({
          type: 'Feature',
          geometry: selectedArea.geometry,
        } as any);
        const selBounds = selectedLayer.getBounds();
        if (selBounds.isValid()) {
          map.fitBounds(selBounds, { padding: [30, 30], maxZoom: 14 });
          return;
        }
      }
    }

    // Otherwise fit to all active corridors
    if (hasPolygons && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }, [corridors, selectedCorridorId, onSelectCorridor]);

  return <div ref={mapContainerRef} className="size-full rounded-2xl" />;
}
