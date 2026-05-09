export type Phase = 'collecting' | 'voting' | 'results';
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
  creatorToken: string;
  date: string;
  createdAt: string;
  phase: Phase;
  groupSize?: number;
  creatorPreferences?: Preferences;
  invitees: Invitee[];
  votes?: Record<string, string[]>; // courseOsmId -> array of voterIds
}
