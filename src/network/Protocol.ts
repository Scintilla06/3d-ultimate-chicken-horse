export interface Packet {
    t: string; // Type
    p: any;    // Payload
    Ts?: number; // Timestamp
}

export enum PacketType {
    INPUT = 'I',
    SNAPSHOT = 'S',
    EVENT_PLACE = 'E_Place',
    EVENT_STATE = 'E_State',
    JOIN = 'J',
    WELCOME = 'W',
    CHARACTER_SELECT = 'C_Sel',
    NICKNAME_CHANGE = 'N_Chg',  // Player changes nickname
    LOBBY_UPDATE = 'L_Upd',
    START_GAME = 'Start',
    PARTY_BOX_UPDATE = 'P_Box',
    PICK_ITEM = 'Pick',
    ITEM_PICKED = 'Picked',
    PLAYER_FINISHED_RUN = 'Fin_Run',
    SHOW_SCORE = 'Score',
    CHAT = 'Chat',
    GAME_WIN = 'Win',
    MAP_SELECT = 'M_Sel',       // Player selects map
    MAP_VOTES = 'M_Votes',      // Broadcast all map votes
    MAP_CHOSEN = 'M_Chosen'     // Final chosen map
}

export interface ChatPayload {
    nickname: string;
    message: string;
    color?: string;  // 玩家名字颜色
    playerId?: string; // 发送者 ID，用于接收方获取颜色
}

export interface MapSelectPayload {
    playerId: string;
    mapId: string;
}

export interface MapVotesPayload {
    votes: { [playerId: string]: string }; // playerId -> mapId
}

export interface MapChosenPayload {
    mapId: string;
}

export interface InputPayload {
    x: number;
    y: number;
    j: boolean;
    cam: number; // Camera angle Y
}

export interface SnapshotPayload {
    id: string;
    pos: number[];
    rot: number[];
    anim: string; // Animation state
}

export interface PlayerInfo {
    id: string;
    nickname: string;
    character: string;
    isHost: boolean;
    isReady: boolean;
    selectedMap?: string; // Player's selected map
}
