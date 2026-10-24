'use client';

// src/components/live-watch/live-map-inner.tsx
// Real Leaflet-based Live Operations Telemetry Map.
// Projects live drivers and active trips over real Lagos vector tiles.

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LiveTrip, OnlineDriver } from '@/types/admin';

interface LiveMapInnerProps {
  drivers: OnlineDriver[];
  trips: LiveTrip[];
  selectedDriver: OnlineDriver | null;
  selectedTrip: LiveTrip | null;
  onSelectDriver: (driver: OnlineDriver) => void;
  onSelectTrip: (trip: LiveTrip) => void;
  isSocketLive: boolean;
}

const LAGOS_CENTER: [number, number] = [6.5244, 3.3792];

export default function LiveMapInner({
  drivers,
  trips,
  selectedDriver,
  selectedTrip,
  onSelectDriver,
  onSelectTrip,
  isSocketLive,
}: LiveMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tripsLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: LAGOS_CENTER,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    // Google Maps crisp roadmap tiles for ultra-fast, watermark-free vector street view
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
    }).addTo(map);

    // Zoom controls at top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const tripsLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    tripsLayerRef.current = tripsLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & Trips whenever drivers or trips data updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const tripsLayer = tripsLayerRef.current;
    if (!map || !markersLayer || !tripsLayer) return;

    markersLayer.clearLayers();
    tripsLayer.clearLayers();

    // ── 1. Render Online Drivers ──────────────────────────────────────
    drivers.forEach((driver) => {
      // Drivers without a GPS fix aren't drawn — no guessed positions.
      if (typeof driver.location?.lat !== 'number' || typeof driver.location?.lng !== 'number') return;
      const lat = driver.location.lat;
      const lng = driver.location.lng;

      const isDriverSelected = selectedDriver?.driverId === driver.driverId;
      const isAvailable = driver.status === 'AVAILABLE';

      // Status styling
      const ringColor = isAvailable ? '#10b981' : '#f59e0b';
      const heading = driver.location?.heading ?? 0;

      const driverIcon = L.divIcon({
        className: 'custom-driver-pin',
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: grid; place-items: center;">
            <div style="
              position: absolute; inset: -4px; border-radius: 9999px;
              background-color: ${ringColor}; opacity: 0.25;
              animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              position: relative; width: 32px; height: 32px; border-radius: 9999px;
              background: #18181b; border: 2.5px solid ${isDriverSelected ? '#d1b784' : ringColor};
              box-shadow: 0 4px 12px rgba(0,0,0,0.35);
              display: flex; align-items: center; justify-content: center;
              transform: rotate(${heading}deg); transition: transform 0.3s ease;
            ">
              <svg width="15" height="15" viewBox="0 0 256 256" fill="${ringColor}">
                <path d="M240,104H224V88a24,24,0,0,0-24-24H56A24,24,0,0,0,32,88v16H16a8,8,0,0,0-8,8v40a8,8,0,0,0,8,8h8a24,24,0,0,0,48,0h112a24,24,0,0,0,48,0h8a8,8,0,0,0,8-8V112A8,8,0,0,0,240,104ZM48,88a8,8,0,0,1,8-8H200a8,8,0,0,1,8,8v16H48ZM64,168a8,8,0,1,1,8-8A8,8,0,0,1,64,168Zm128,0a8,8,0,1,1,8-8A8,8,0,0,1,192,168Z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([lat, lng], { icon: driverIcon });

      const dpHtml = driver.avatarUrl || driver.selfieUrl
        ? `<img src="${driver.avatarUrl || driver.selfieUrl}" style="width: 32px; height: 32px; border-radius: 10px; object-fit: cover;" />`
        : `<div style="width: 32px; height: 32px; border-radius: 10px; background: #27272a; color: #d1b784; display: grid; place-items: center; font-weight: bold; font-size: 12px;">${driver.firstname?.charAt(0) ?? 'D'}</div>`;

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #18181b; min-width: 170px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            ${dpHtml}
            <div>
              <div style="font-weight: 700; font-size: 13px;">${driver.firstname ?? 'Driver'} ${driver.lastname ?? ''}</div>
              <div style="font-size: 10px; color: #71717a;">${driver.phone ?? driver.driverId.slice(0, 8)}</div>
            </div>
          </div>
          <div style="font-size: 11px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #e4e4e7;">
            <div><strong>Status:</strong> <span style="color: ${ringColor}; font-weight: 600;">${driver.status}</span></div>
            <div><strong>Vehicle:</strong> ${driver.vehicle?.licensePlate ?? 'No plate'} (${driver.vehicle?.model ?? 'Vehicle'})</div>
          </div>
        </div>
      `);

      marker.on('click', () => {
        onSelectDriver(driver);
      });

      markersLayer.addLayer(marker);
    });

    // ── 2. Render In-Flight Trips ─────────────────────────────────────
    trips.forEach((trip) => {
      const pLat = trip.pickup.lat;
      const pLng = trip.pickup.lng;
      const dLat = trip.destination.lat;
      const dLng = trip.destination.lng;

      // Pickup Pin
      const pickupIcon = L.divIcon({
        className: 'custom-pickup-pin',
        html: `
          <div style="width: 14px; height: 14px; border-radius: 9999px; background: #10b981; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      // Dropoff Pin
      const dropoffIcon = L.divIcon({
        className: 'custom-dropoff-pin',
        html: `
          <div style="width: 14px; height: 14px; border-radius: 9999px; background: #3b82f6; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const pMarker = L.marker([pLat, pLng], { icon: pickupIcon });
      const dMarker = L.marker([dLat, dLng], { icon: dropoffIcon });

      pMarker.bindPopup(`<b>Pickup:</b> ${trip.pickup.address}`);
      dMarker.bindPopup(`<b>Destination:</b> ${trip.destination.address}`);

      pMarker.on('click', () => onSelectTrip(trip));
      dMarker.on('click', () => onSelectTrip(trip));

      tripsLayer.addLayer(pMarker);
      tripsLayer.addLayer(dMarker);

      // Trajectory Line
      const routeLine = L.polyline([[pLat, pLng], [dLat, dLng]], {
        color: '#d1b784',
        weight: 3,
        opacity: 0.75,
        dashArray: '6, 6',
      });
      routeLine.on('click', () => onSelectTrip(trip));
      tripsLayer.addLayer(routeLine);
    });
  }, [drivers, trips, selectedDriver, onSelectDriver, onSelectTrip]);

  // Pan to selected item
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedDriver?.location) {
      map.flyTo([selectedDriver.location.lat, selectedDriver.location.lng], 15, { duration: 1 });
    } else if (selectedTrip) {
      map.flyTo([selectedTrip.pickup.lat, selectedTrip.pickup.lng], 14, { duration: 1 });
    }
  }, [selectedDriver, selectedTrip]);

  return (
    <div className="relative size-full overflow-hidden rounded-3xl bg-surface">
      <div ref={mapContainerRef} className="size-full z-0" />

      {/* Realtime Telemetry Pill */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-2xl bg-overlay/90 backdrop-blur-md px-3.5 py-2">
        <span className={`size-2.5 rounded-full ${isSocketLive ? 'bg-success animate-pulse' : 'bg-warning'}`} />
        <span className="text-xs font-medium text-foreground">
          {isSocketLive ? 'Live' : 'Refreshing every 10s'}
        </span>
        <span className="text-xs text-muted tabular">
          · {drivers.length} drivers · {trips.length} in flight
        </span>
      </div>

      {/* Recenter Lagos Button */}
      <button
        type="button"
        onClick={() => {
          mapInstanceRef.current?.flyTo(LAGOS_CENTER, 12, { duration: 1 });
        }}
        className="absolute bottom-4 left-4 z-10 rounded-2xl bg-overlay/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-foreground hover:bg-overlay cursor-pointer"
      >
        Recenter Lagos
      </button>
    </div>
  );
}
