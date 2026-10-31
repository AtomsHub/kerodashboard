'use client';

// src/components/trips/trip-map-inner.tsx
// Leaflet map for a single trip: planned route, pickup/drop-off, recorded
// driver + rider breadcrumbs, their live positions, and where the driver
// was when they accepted, arrived, started and ended the trip.

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TripMapProps } from './trip-map';

/** Decode a Google encoded polyline into [lat, lng] pairs. */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;

function dotIcon(color: string, ring = '#ffffff') {
  return L.divIcon({
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:4px solid ${ring};box-shadow:0 1px 4px rgba(0,0,0,.25)"></span>`,
  });
}

/** Small labelled pin for a trip step ("Arrived · 10:32"). */
function stepIcon(label: string, bg: string) {
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<span style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center"><span style="white-space:nowrap;padding:3px 8px;border-radius:9999px;background:${bg};color:#fff;font:600 11px Satoshi,system-ui;box-shadow:0 1px 4px rgba(0,0,0,.25)">${label}</span><span style="width:2px;height:6px;background:${bg}"></span><span style="width:8px;height:8px;border-radius:9999px;background:${bg};border:2px solid #fff"></span></span>`,
  });
}

const STEP_KEYS = ['accepted', 'arrived', 'started', 'ended'];
const STEP_LABELS: Record<string, string> = { accepted: 'Accepted', arrived: 'Arrived', started: 'Started', ended: 'Ended' };
const MARKER_BG = '#2b2a28'; // dark pin on the light map, in light and dark mode
const stepTime = (at: string | null) => (at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);

function badgeIcon(label: string, bg: string, fg: string, heading?: number | null) {
  const arrow =
    typeof heading === 'number'
      ? `<span style="position:absolute;top:-7px;left:50%;transform:translateX(-50%) rotate(${heading}deg);transform-origin:50% 22px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:7px solid ${bg}"></span>`
      : '';
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<span style="position:relative;display:grid;place-items:center;width:34px;height:34px;border-radius:9999px;background:${bg};color:${fg};font:700 11px Satoshi,system-ui;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25)">${arrow}${label}</span>`,
  });
}

export default function TripMapInner({
  start,
  end,
  polyline,
  driverTrail,
  riderTrail,
  driverLocation,
  riderLocation,
  follow,
  checkpoints,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const staticLayer = useRef<L.LayerGroup | null>(null);
  const liveLayer = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    staticLayer.current = L.layerGroup().addTo(map);
    liveLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Planned route, endpoints and breadcrumbs.
  useEffect(() => {
    const map = mapRef.current;
    const layer = staticLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const gold = css('--secondary') ?? '#bb9348';
    const ink = css('--foreground') ?? '#353535';
    const success = css('--success') ?? '#34c759';
    const muted = css('--muted') ?? '#7b7b7b';

    const planned = polyline ? decodePolyline(polyline) : [];
    const plannedLine: [number, number][] =
      planned.length > 1 ? planned : [[start.lat, start.lng], [end.lat, end.lng]];
    L.polyline(plannedLine, { color: muted, weight: 4, opacity: 0.45, dashArray: '6 8' }).addTo(layer);

    if (riderTrail.length > 1) {
      L.polyline(riderTrail.map((p) => [p.lat, p.lng] as [number, number]), { color: ink, weight: 3, opacity: 0.5 }).addTo(layer);
    }
    if (driverTrail.length > 1) {
      L.polyline(driverTrail.map((p) => [p.lat, p.lng] as [number, number]), { color: gold, weight: 5, opacity: 0.9 }).addTo(layer);
    }

    L.marker([start.lat, start.lng], { icon: dotIcon(success) }).bindTooltip('Pickup').addTo(layer);
    L.marker([end.lat, end.lng], { icon: dotIcon(ink) }).bindTooltip('Drop-off').addTo(layer);

    // Where the driver was when they accepted, arrived, started and ended.
    for (const c of checkpoints ?? []) {
      if (!STEP_KEYS.includes(c.key) || !c.location) continue;
      const time = stepTime(c.at);
      const label = STEP_LABELS[c.key] ?? c.label;
      L.marker([c.location.lat, c.location.lng], { icon: stepIcon(time ? `${label} · ${time}` : label, MARKER_BG), zIndexOffset: 200 })
        .bindTooltip(c.label)
        .addTo(layer);
    }

    if (!fittedRef.current) {
      const bounds = L.latLngBounds(plannedLine);
      driverTrail.forEach((p) => bounds.extend([p.lat, p.lng]));
      if (driverLocation) bounds.extend([driverLocation.lat, driverLocation.lng]);
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      fittedRef.current = true;
    }
  }, [start, end, polyline, driverTrail, riderTrail, driverLocation, checkpoints]);

  // Live driver / rider markers.
  useEffect(() => {
    const map = mapRef.current;
    const layer = liveLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const gold = css('--secondary') ?? '#bb9348';
    const goldFg = css('--secondary-foreground') ?? '#282724';
    const ink = css('--foreground') ?? '#353535';

    if (riderLocation) {
      L.marker([riderLocation.lat, riderLocation.lng], { icon: badgeIcon('R', ink, '#fff'), zIndexOffset: 500 })
        .bindTooltip('Rider')
        .addTo(layer);
    }
    if (driverLocation) {
      L.marker([driverLocation.lat, driverLocation.lng], {
        icon: badgeIcon('D', gold, goldFg, driverLocation.heading),
        zIndexOffset: 1000,
      })
        .bindTooltip('Driver')
        .addTo(layer);
      if (follow) map.panTo([driverLocation.lat, driverLocation.lng], { animate: true });
    }
  }, [driverLocation, riderLocation, follow]);

  return <div ref={containerRef} className="size-full" />;
}
