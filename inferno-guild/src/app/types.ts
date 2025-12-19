
export type Branch = 'Inferno-1' | 'Inferno-2' | 'Inferno-3';

export type CharacterClass = 'Ironclan' | 'Bloodstorm' | 'Celestune' | 'Sylph' | 'Numina' | 'Nightwalker';

export type MemberColor = 'red' | 'purple' | 'blue' | null;

export interface Member {
  id: string;
  name: string;
  class: CharacterClass;
  power: number;
  branch: Branch;
  status: 'Active'; 
  joinDate: string;
  leaveCount: number; 
  warLeaveCount?: number;
  generalLeaveCount?: number;
  party?: number; // 20:00 Slot
  party2?: number; // 20:30 Slot (New)
  posParty?: number;
  posParty2?: number;
  color?: MemberColor;
  isSpecial?: boolean;
}

export interface LeaveRequest {
  id: string;
  memberId: string;
  warDate: string; 
  reason: string;
  timestamp: string;
  recordedBy: string; 
}

export interface WarSetSlot {
  role: 'Tank' | 'Healer' | 'DPS' | 'Support' | 'Any';
  memberId: string | null;
}

export interface SubParty {
  id: number; // 1 to 10
  name: string;
  slots: WarSetSlot[]; // 6 slots
}

export interface PartyGroup {
  id: string;
  name: string;
  subPartyIds: number[]; 
  color?: string;
  order_by?: number;
}

export interface PartyGroupConfig {
  branch: Branch;
  groups: PartyGroup[];
}

// Updated RegularWar to support multiple images
export interface RegularWar {
  id: string;
  branch: Branch;
  date: string;
  opponent: string;
  outcome: 'Victory' | 'Defeat';
  images: string[]; // Changed from single image string to array
}

export interface WarPlan {
  id: string;
  name: string;
  images: string[];
}

export interface WarResult {
  outcome: 'Victory' | 'Defeat';
  opponent: string;
  ourScore: number;
  enemyScore: number;
  warPlanId?: string; 
}

export interface WarEvent {
  id: string;
  date: string;
  branch: Branch;
  subParties: SubParty[];
  groups: PartyGroup[];
  result?: WarResult;
  snapshotLeaves?: Array<{memberId: string;name: string;class?: CharacterClass;power?: number;branch?: Branch;leaveType: 'War' | 'Personal';session?: '20:00' | '20:30';warDate?: string;}>;
  snapshotReserves?: { memberId: string; name: string; power: number; class: CharacterClass }[];
}

export interface GameEvent {
  id: string;
  title: string;
  date: string; 
  type: 'Activity' | 'Meeting' | 'Other';
  description?: string;
}
