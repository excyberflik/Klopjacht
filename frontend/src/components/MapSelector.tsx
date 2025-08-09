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

// Real reverse geocoding function using OpenStreetMap Nominatim API
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    // Use OpenStreetMap Nominatim API for free reverse geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Klopjacht-Game-App/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding API request failed');
    }

    const data = await response.json();
    
    if (data && data.display_name) {
      // Extract meaningful address components
      const address = data.address || {};
      
      // Build a clean address string
      let addressParts = [];
      
      // Add house number and street
      if (address.house_number && address.road) {
        addressParts.push(`${address.road} ${address.house_number}`);
      } else if (address.road) {
        addressParts.push(address.road);
      }
      
      // Add city/town/village
      if (address.city) {
        addressParts.push(address.city);
      } else if (address.town) {
        addressParts.push(address.town);
      } else if (address.village) {
        addressParts.push(address.village);
      } else if (address.municipality) {
        addressParts.push(address.municipality);
      }
      
      // Add country
      if (address.country) {
        addressParts.push(address.country);
      }
      
      // If we have meaningful address parts, use them
      if (addressParts.length > 0) {
        return addressParts.join(', ');
      }
      
      // Otherwise, use the full display name but clean it up
      let displayName = data.display_name;
      
      // Limit length and clean up
      if (displayName.length > 100) {
        const parts = displayName.split(', ');
        displayName = parts.slice(0, 4).join(', ');
        if (parts.length > 4) {
          displayName += '...';
        }
      }
      
      return displayName;
    }
    
    // Fallback if no address found
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    
    // Fallback to basic location detection
    return getFallbackLocation(lat, lng);
  }
}

// Fallback function for when API fails
function getFallbackLocation(lat: number, lng: number): string {
  // Basic country/region detection based on coordinates
  if (lat >= 50.5 && lat <= 53.7 && lng >= 3.0 && lng <= 7.5) {
    // Netherlands/Belgium area
    if (lat >= 52.0 && lng >= 4.5) {
      return `Location in Netherlands (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    } else if (lat <= 51.5 && lng <= 6.0) {
      return `Location in Belgium (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  }
  
  // Generic fallback
  return `Selected Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
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
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // Get user's current location
  useEffect(() => {
    if (initialLocation) {
      setLocationLoading(false);
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation([latitude, longitude]);
          setLocationLoading(false);
        },
        (error) => {
          console.warn('Geolocation failed:', error);
          // Fallback to Amsterdam if geolocation fails
          setCurrentLocation([52.3676, 4.9041]);
          setLocationLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } else {
      console.warn('Geolocation not supported');
      // Fallback to Amsterdam if geolocation not supported
      setCurrentLocation([52.3676, 4.9041]);
      setLocationLoading(false);
    }
  }, [initialLocation]);

  // Determine map center
  const getMapCenter = (): [number, number] => {
    if (initialLocation) {
      return [initialLocation.lat, initialLocation.lng];
    }
    if (currentLocation) {
      return currentLocation;
    }
    // Final fallback to Amsterdam
    return [52.3676, 4.9041];
  };

  const center = getMapCenter();

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
        
        {locationLoading ? (
          <div className="map-loading" style={{ 
            height: '400px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            color: '#666'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌍</div>
              <div>Getting your location...</div>
              <small>This helps center the map near you</small>
            </div>
          </div>
        ) : (
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
        )}

        <div className="map-selector-info">
          {selectedLocation ? (
            <div className="selected-location">
              <strong>📍 {selectedLocation.address}</strong>
              <br />
              <small>Coordinates: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}</small>
            </div>
          ) : (
            <div className="no-selection">
              {locationLoading ? 'Preparing map...' : 'Click on the map to select a location'}
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
