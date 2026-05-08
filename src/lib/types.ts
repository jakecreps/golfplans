export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface Location {
  address: string;
  lat: number;
  lng: number;
}

export interface Preferences {
  timeOfDay: TimeOfDay[];
  maxPrice: number;
  location: Location;
  maxDriveDistance: number;
}

export interface Invitee {
  id: string;
  responded: boolean;
  preferences?: Preferences;
}

export interface Plan {
  id: string;
  creatorToken: string; // secret token — only organizer has this URL
  date: string; // YYYY-MM-DD
  createdAt: string;
  noExpiry?: boolean; // set true to disable 24h expiry (for testing)
  creatorPreferences?: Preferences;
  invitees: Invitee[];
}
