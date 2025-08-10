import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different location types
const missionIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const extractionIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const fugitiveIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const hunterIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const spectatorIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface GameMapProps {
  game: any;
}

const GameMap: React.FC<GameMapProps> = ({ game }) => {
  const allLocations: Array<{
    lat: number;
    lng: number;
    title: string;
    type: 'mission' | 'extraction' | 'fugitive' | 'hunter' | 'spectator';
    details: string;
  }> = [];

  // Add mission locations
  if (game.tasks) {
    game.tasks.forEach((task: any) => {
      if (task.location?.latitude && task.location?.longitude) {
        allLocations.push({
          lat: task.location.latitude,
          lng: task.location.longitude,
          title: task.taskNumber === 6 ? 'Extraction Point' : `Mission ${task.taskNumber}`,
          type: task.taskNumber === 6 ? 'extraction' : 'mission',
          details: task.location.address || 'No address available'
        });
      }
    });
  }

  // Add extraction point if not in tasks
  if (game.extractionPoint && 
      game.extractionPoint.latitude && 
      game.extractionPoint.longitude &&
      !game.tasks?.find((t: any) => t.taskNumber === 6)) {
    allLocations.push({
      lat: game.extractionPoint.latitude,
      lng: game.extractionPoint.longitude,
      title: 'Extraction Point',
      type: 'extraction',
      details: game.extractionPoint.address || 'No address available'
    });
  }

  // Add player locations
  if (game.joinedPlayers) {
    game.joinedPlayers.forEach((player: any) => {
      if (player.currentLocation?.latitude && player.currentLocation?.longitude) {
        allLocations.push({
          lat: player.currentLocation.latitude,
          lng: player.currentLocation.longitude,
          title: `${player.name} (${player.role})`,
          type: player.role === 'fugitive' ? 'fugitive' : 
                player.role === 'hunter' ? 'hunter' : 'spectator',
          details: player.currentLocation.address || 
                  `Tasks: ${player.completedTasks?.length || player.gameStats?.tasksCompleted || player.tasksCompleted || 0}/6`
        });
      }
    });
  }

  if (allLocations.length === 0) {
    return (
      <div style={{ 
        height: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        color: '#6c757d'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
          <div>No location data available to display on map</div>
        </div>
      </div>
    );
  }

  // Calculate center and bounds
  const centerLat = allLocations.reduce((sum, loc) => sum + loc.lat, 0) / allLocations.length;
  const centerLng = allLocations.reduce((sum, loc) => sum + loc.lng, 0) / allLocations.length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'mission': return missionIcon;
      case 'extraction': return extractionIcon;
      case 'fugitive': return fugitiveIcon;
      case 'hunter': return hunterIcon;
      case 'spectator': return spectatorIcon;
      default: return missionIcon;
    }
  };

  return (
    <div style={{ height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {allLocations.map((location, index) => (
          <Marker
            key={index}
            position={[location.lat, location.lng]}
            icon={getIcon(location.type)}
          >
            <Popup>
              <div>
                <strong>{location.title}</strong><br/>
                {location.details}<br/>
                <small>
                  📍 {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </small>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default GameMap;
