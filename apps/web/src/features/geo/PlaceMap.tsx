import 'leaflet/dist/leaflet.css';
import type { GeoPoint } from '@ordo/shared';
import { latLngBounds } from 'leaflet';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import classes from './PlaceMap.module.css';

/** Point shown on the map. */
export interface MapPoint extends GeoPoint {
  id: string;
  label: string;
  /** The point being edited: highlighted. */
  active?: boolean;
}

/** France, without points to show. */
const DEFAULT_CENTER: [number, number] = [46.6, 2.4];

/**
 * Frames the points: the one point closely, several all together.
 * @param {{ points: readonly GeoPoint[] }} props Points.
 * @returns {null} Nothing rendered.
 */
function Framing({ points }: { points: readonly GeoPoint[] }) {
  const map = useMap();
  const key = points.map((point) => `${point.lat},${point.lon}`).join(';');
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lon], Math.max(map.getZoom(), 15));
    else if (points.length > 1) map.fitBounds(latLngBounds(points.map((point) => [point.lat, point.lon])), { padding: [24, 24], maxZoom: 15 });
    // Only when the points change, not on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/**
 * Picks a point with a click on the map.
 * @param {{ onPick: (point: GeoPoint) => void }} props Handler.
 * @returns {null} Nothing rendered.
 */
function Picking({ onPick }: { onPick: (point: GeoPoint) => void }) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lon: event.latlng.lng }) });
  return null;
}

interface PlaceMapProps {
  points: readonly MapPoint[];
  /** A click on the map picks a point. */
  onPick?: (point: GeoPoint) => void;
  /** A click on a point. */
  onSelect?: (id: string) => void;
  height?: number | string;
}

/**
 * OpenStreetMap map with points (saved places, the address of an event), framed on them; a click can pick a new
 * point.
 * @param {PlaceMapProps} props Component props.
 * @returns {JSX.Element} Map.
 */
export function PlaceMap({ points, onPick, onSelect, height = 240 }: PlaceMapProps) {
  return (
    <div className={classes.root} style={{ height }} data-picking={onPick ? true : undefined}>
      <MapContainer center={DEFAULT_CENTER} zoom={5} className={classes.map} scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        {points.map((point) => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lon]}
            radius={point.active ? 9 : 7}
            pathOptions={{ className: point.active ? classes.activePoint : classes.point }}
            eventHandlers={onSelect ? { click: () => onSelect(point.id) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {point.label}
            </Tooltip>
          </CircleMarker>
        ))}
        <Framing points={points} />
        {onPick && <Picking onPick={onPick} />}
      </MapContainer>
    </div>
  );
}
