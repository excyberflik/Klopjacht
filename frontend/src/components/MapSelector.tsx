import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface MapSelectorProps {
  initialLocation?: Location;
  onLocationSelect: (location: Location) => void;
  onClose: () => void;
}

// Component to handle map clicks
function LocationMarker({ onLocationSelect }: { onLocationSelect: (location: Location) => void }) {
  const [position, setPosition] = useState<[number, number] | null>(null);

  const map = useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      
      // Reverse geocoding to get address (mock implementation)
      const address = await reverseGeocode(lat, lng);
      onLocationSelect({ lat, lng, address });
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

// Mock reverse geocoding function
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // In a real implementation, you would use a geocoding service
  // For now, we'll use mock Amsterdam locations based on coordinates
  const amsterdamLocations = [
    { lat: 52.3676, lng: 4.9041, address: 'Dam Square, Amsterdam' },
    { lat: 52.3702, lng: 4.8952, address: 'Vondelpark, Amsterdam' },
    { lat: 52.3738, lng: 4.8910, address: 'Museumplein, Amsterdam' },
    { lat: 52.3731, lng: 4.8922, address: 'Rijksmuseum, Amsterdam' },
    { lat: 52.3680, lng: 4.9036, address: 'Royal Palace, Amsterdam' },
    { lat: 52.3792, lng: 4.8994, address: 'Anne Frank House, Amsterdam' },
    { lat: 52.3676, lng: 4.9041, address: 'Central Station, Amsterdam' },
    { lat: 52.3667, lng: 4.8945, address: 'Leidseplein, Amsterdam' },
    { lat: 52.3740, lng: 4.8897, address: 'Van Gogh Museum, Amsterdam' },
    { lat: 52.3675, lng: 4.9040, address: 'Nieuwmarkt, Amsterdam' },
  ];

  // Find the closest location
  let closestLocation = amsterdamLocations[0];
  let minDistance = calculateDistance(lat, lng, closestLocation.lat, closestLocation.lng);

  for (const location of amsterdamLocations) {
    const distance = calculateDistance(lat, lng, location.lat, location.lng);
    if (distance < minDistance) {
      minDistance = distance;
      closestLocation = location;
    }
  }

  // If very close to a known location, use that address
  if (minDistance < 0.01) {
    return closestLocation.address;
  }

  // Otherwise, generate a generic address
  return `Location near Amsterdam (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const MapSelector: React.FC<MapSelectorProps> = ({ initialLocation, onLocationSelect, onClose }) => {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(initialLocation || null);

  // Default to Amsterdam center
  const defaultCenter: [number, number] = [52.3676, 4.9041];
  const center = initialLocation ? [initialLocation.lat, initialLocation.lng] as [number, number] : defaultCenter;

  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
      onClose();
    }
  };

  return (
    <div className="map-selector-overlay">
      <div className="map-selector-modal">
        <div className="map-selector-header">
          <h3>📍 Select Location on Map</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="map-container">
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: '400px', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker onLocationSelect={handleLocationSelect} />
            {selectedLocation && (
              <Marker position={[selectedLocation.lat, selectedLocation.lng]} />
            )}
          </MapContainer>
        </div>

        <div className="map-selector-info">
          {selectedLocation ? (
            <div className="selected-location">
              <strong>📍 {selectedLocation.address}</strong>
              <br />
              <small>Coordinates: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}</small>
            </div>
          ) : (
            <div className="no-selection">
              Click on the map to select a location
            </div>
          )}
        </div>

        <div className="map-selector-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleConfirm}
            disabled={!selectedLocation}
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapSelector;
