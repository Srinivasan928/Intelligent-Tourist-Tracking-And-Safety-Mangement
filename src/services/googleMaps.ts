export interface GeocodeResult {
  street: string;
  country: string;
  locality: string;
  formattedAddress: string;
  lat?: number;
  lng?: number;
}

let googleMapsPromise: Promise<any> | null = null;

export const GOOGLE_MAPS_API_KEY =
  ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) ||
  "AIzaSyCn2MsIC4918ooEk8M5TJ1DGzDCClTCIB0";

// Initialize Google Maps loader
export function getGoogleMaps(): Promise<any> | null {
  const apiKey = GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (typeof window !== "undefined" && (window as any).google?.maps) {
    return Promise.resolve((window as any).google);
  }

  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        resolve(null);
        return;
      }
      if ((window as any).google?.maps) {
        resolve((window as any).google);
        return;
      }
      const existing = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existing) {
        existing.addEventListener("load", () => resolve((window as any).google));
        existing.addEventListener("error", (e) => reject(e));
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding,marker`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve((window as any).google);
      script.onerror = (err) => {
        console.warn("Google Maps script load error, fallback geocoding active:", err);
        googleMapsPromise = null;
        reject(err);
      };
      document.head.appendChild(script);
    });
  }

  return googleMapsPromise;
}

// Fallback lookup table for standard coordinates in Dhimbam Forest Range & Sathyamangalam Tiger Reserve
const KNOWN_LOCATIONS: Array<{
  bounds: [number, number, number, number]; // minLat, maxLat, minLng, maxLng
  street: string;
  locality: string;
  country: string;
  formattedAddress: string;
}> = [
  {
    bounds: [11.605, 11.625, 77.115, 77.135],
    street: "Dhimbam Ghat Viewpoint (27th Hairpin Bend, NH 948)",
    locality: "Dhimbam, Sathyamangalam, Tamil Nadu",
    country: "India",
    formattedAddress: "Dhimbam Ghat 27th Bend, NH 948, Sathyamangalam, Erode, Tamil Nadu 638461, India",
  },
  {
    bounds: [11.625, 11.645, 77.105, 77.128],
    street: "Hasanur Forest Trail (Sathyamangalam Tiger Reserve)",
    locality: "Hasanur, Sathyamangalam, Tamil Nadu",
    country: "India",
    formattedAddress: "Hasanur Forest Range, STR, Sathyamangalam, Erode, Tamil Nadu 638461, India",
  },
  {
    bounds: [11.585, 11.605, 77.135, 77.155],
    street: "Bannari Forest Checkpost (NH 948)",
    locality: "Bannari, Sathyamangalam, Tamil Nadu",
    country: "India",
    formattedAddress: "Bannari Amman Forest Checkpost, Sathyamangalam, Erode, Tamil Nadu 638401, India",
  },
  {
    bounds: [11.635, 11.655, 77.085, 77.105],
    street: "Talamalai Forest Ravine (Off Hasanur-Talamalai Rd)",
    locality: "Talamalai Forest Range, Sathyamangalam, Tamil Nadu",
    country: "India",
    formattedAddress: "Talamalai Wild Forest, Dhimbam Range, Sathyamangalam, Erode, Tamil Nadu 638461, India",
  },
  {
    bounds: [11.570, 11.590, 77.145, 77.165],
    street: "Moyar River Valley Corridor",
    locality: "Sathyamangalam Tiger Reserve, Tamil Nadu",
    country: "India",
    formattedAddress: "Moyar Gorge & Valley, Sathyamangalam, Erode, Tamil Nadu 638401, India",
  },
  {
    bounds: [11.500, 11.520, 77.225, 77.250],
    street: "Sathyamangalam Forest Division Headquarters",
    locality: "Sathyamangalam, Erode, Tamil Nadu",
    country: "India",
    formattedAddress: "Sathyamangalam Forest Range Office, Tamil Nadu 638401, India",
  }
];

function getRegionalFallback(lat: number, lng: number): GeocodeResult {
  // Check known Sathyamangalam / Dhimbam precise regions first
  for (const loc of KNOWN_LOCATIONS) {
    const [minLat, maxLat, minLng, maxLng] = loc.bounds;
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return {
        street: loc.street,
        country: loc.country,
        locality: loc.locality,
        formattedAddress: loc.formattedAddress,
        lat,
        lng,
      };
    }
  }

  // If within Dhimbam / STR broader bounds (lat 11.45 - 11.75, lng 76.95 - 77.40)
  if (lat >= 11.45 && lat <= 11.75 && lng >= 76.95 && lng <= 77.40) {
    return {
      street: `Dhimbam Range Track (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      country: "India",
      locality: "Dhimbam Forest Range, Sathyamangalam, Tamil Nadu",
      formattedAddress: `Dhimbam Ghat Reserve, Sathyamangalam Tiger Reserve, Tamil Nadu, India`,
      lat,
      lng,
    };
  }

  // Southeast Asia / Thailand / Gulf of Thailand (e.g. lat 5.0 - 21.0, lng 97.0 - 106.0)
  if (lat >= 5.0 && lat <= 21.0 && lng >= 97.0 && lng <= 106.0) {
    const isGulf = lat >= 9.0 && lat <= 13.5 && lng >= 99.5 && lng <= 102.5;
    return {
      street: isGulf ? `Gulf of Thailand Route (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)` : `Coastal Route (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      country: "Thailand",
      locality: "Southern / Central Region, Thailand",
      formattedAddress: `${isGulf ? "Gulf of Thailand" : "Gulf Coast"}, Thailand (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      lat,
      lng,
    };
  }

  // Vietnam / Indochina
  if (lat >= 8.5 && lat <= 23.5 && lng >= 102.0 && lng <= 110.0) {
    return {
      street: `Indochina Coastal Corridor (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      country: "Vietnam",
      locality: "Vietnam",
      formattedAddress: `Vietnam (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      lat,
      lng,
    };
  }

  // Broader India (lat 8.0 - 37.0, lng 68.0 - 97.5)
  if (lat >= 8.0 && lat <= 37.0 && lng >= 68.0 && lng <= 97.5) {
    let stateName = "India";
    if (lat < 14.0 && lng < 80.5) stateName = "Tamil Nadu / South India";
    else if (lat < 16.0 && lng < 77.0) stateName = "Karnataka";
    else if (lat < 20.0 && lng < 84.0) stateName = "Maharashtra / Deccan";
    else if (lat >= 28.0 && lng >= 76.0 && lng <= 78.0) stateName = "National Capital Region";

    return {
      street: `Route / Landmark (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      country: "India",
      locality: stateName,
      formattedAddress: `${stateName}, India (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      lat,
      lng,
    };
  }

  // North America (lat 24.0 - 55.0, lng -125.0 - -65.0)
  if (lat >= 24.0 && lat <= 55.0 && lng >= -125.0 && lng <= -65.0) {
    return {
      street: `Way / Route (${lat.toFixed(4)}°N, ${Math.abs(lng).toFixed(4)}°W)`,
      country: "United States",
      locality: "North America",
      formattedAddress: `United States (${lat.toFixed(4)}°N, ${Math.abs(lng).toFixed(4)}°W)`,
      lat,
      lng,
    };
  }

  // Europe (lat 35.0 - 71.0, lng -10.0 - 40.0)
  if (lat >= 35.0 && lat <= 71.0 && lng >= -10.0 && lng <= 40.0) {
    return {
      street: `European Route (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      country: "Europe",
      locality: "European Continent",
      formattedAddress: `Europe (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      lat,
      lng,
    };
  }

  // Global coordinates fallback
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
  return {
    street: `Location (${latStr}, ${lngStr})`,
    country: "International",
    locality: `Coordinates ${latStr}, ${lngStr}`,
    formattedAddress: `Global Position ${latStr}, ${lngStr}`,
    lat,
    lng,
  };
}

/**
 * Reverse geocode coordinates to obtain Street and Country according to Google Maps
 */
export async function reverseGeocodeWithGoogleMaps(lat: number, lng: number): Promise<GeocodeResult> {
  // 1. Try server-side API proxy first (which checks backend Google Maps API Key or geocode services)
  try {
    const res = await fetch(`/api/maps/geocode?lat=${lat}&lng=${lng}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.street && data.country) {
        return data;
      }
    }
  } catch (err) {
    // Continue
  }

  // 2. Try client-side Google Maps JavaScript Geocoder
  try {
    const gmaps = getGoogleMaps();
    if (gmaps) {
      const google = await gmaps;
      if (google?.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response && Array.isArray(response.results) && response.results.length > 0) {
          const first = response.results[0];
          const components = Array.isArray(first?.address_components) ? first.address_components : [];

          const route = components.find((c: any) => c?.types?.includes("route"))?.long_name;
          const streetNumber = components.find((c: any) => c?.types?.includes("street_number"))?.long_name;
          const pointOfInterest = components.find((c: any) =>
            c?.types?.includes("point_of_interest") || c?.types?.includes("natural_feature") || c?.types?.includes("park")
          )?.long_name;
          const country = components.find((c: any) => c?.types?.includes("country"))?.long_name || "Unknown Country";
          const locality = components.find((c: any) =>
            c?.types?.includes("locality") || c?.types?.includes("administrative_area_level_2")
          )?.long_name || "Region";
          const adminArea = components.find((c: any) => c?.types?.includes("administrative_area_level_1"))?.short_name || "";

          const street = streetNumber && route ? `${streetNumber} ${route}` : (route || pointOfInterest || (first as any).name || `Route at ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

          return {
            street,
            country,
            locality: adminArea ? `${locality}, ${adminArea}` : locality,
            formattedAddress: first.formatted_address,
            lat,
            lng,
          };
        }
      }
    }
  } catch (clientErr) {
    console.warn("Client-side Google Maps Geocoder notice:", clientErr);
  }

  // 3. Try high-precision open reverse geocoding (BigDataCloud client reverse geocode - instant, free, worldwide)
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      if (bdcData && (bdcData.countryName || bdcData.locality || bdcData.principalSubdivision)) {
        const country = bdcData.countryName || "International";
        const locality = [bdcData.locality || bdcData.city, bdcData.principalSubdivision].filter(Boolean).join(", ") || country;
        const street = bdcData.localityInfo?.informative?.[0]?.name || bdcData.locality || `Track (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`;
        const formattedAddress = [street, locality, country].filter(Boolean).join(", ");
        return {
          street,
          country,
          locality,
          formattedAddress,
          lat,
          lng,
        };
      }
    }
  } catch (err) {
    // Network fallback
  }

  // 4. Try OpenStreetMap Nominatim reverse geocoding
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (nomData && nomData.address) {
        const addr = nomData.address;
        const street = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.village || `Route (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`;
        const country = addr.country || "International";
        const locality = addr.city || addr.town || addr.county || addr.state || "";
        return {
          street,
          country,
          locality,
          formattedAddress: nomData.display_name || `${street}, ${locality}, ${country}`,
          lat,
          lng,
        };
      }
    }
  } catch (err) {
    // Fallback
  }

  // 5. Fallback to coordinate-based regional database
  return getRegionalFallback(lat, lng);
}

/**
 * Forward geocode a street address / city / country query using Google Maps
 */
export async function forwardGeocodeWithGoogleMaps(query: string): Promise<GeocodeResult | null> {
  // Try server endpoint
  try {
    const res = await fetch(`/api/maps/geocode?address=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.lat && data.lng) {
        return data;
      }
    }
  } catch (err) {
    // Continue
  }

  // Try client-side Geocoder
  try {
    const gmaps = getGoogleMaps();
    if (gmaps) {
      const google = await gmaps;
      if (google?.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({ address: query });
        if (response && Array.isArray(response.results) && response.results.length > 0) {
          const first = response.results[0];
          const lat = typeof first?.geometry?.location?.lat === "function" ? first.geometry.location.lat() : 11.6150;
          const lng = typeof first?.geometry?.location?.lng === "function" ? first.geometry.location.lng() : 77.1250;
          const components = Array.isArray(first?.address_components) ? first.address_components : [];

          const route = components.find((c: any) => c?.types?.includes("route"))?.long_name;
          const streetNumber = components.find((c: any) => c?.types?.includes("street_number"))?.long_name;
          const country = components.find((c: any) => c?.types?.includes("country"))?.long_name || "India";
          const locality = components.find((c: any) => c?.types?.includes("locality"))?.long_name || "Sathyamangalam";
          const street = streetNumber && route ? `${streetNumber} ${route}` : (route || (first as any).name || query);

          return {
            street,
            country,
            locality,
            formattedAddress: first.formatted_address,
            lat,
            lng,
          };
        }
      }
    }
  } catch (err) {
    console.warn("Forward geocode error:", err);
  }

  return null;
}

export function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function getGoogleStreetViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}
