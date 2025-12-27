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
    LOBBY_UPDATE = 'L_Upd',
    START_GAME = 'Start',
    PARTY_BOX_UPDATE = 'P_Box',
    PICK_ITEM = 'Pick',
    ITEM_PICKED = 'Picked',
    PLAYER_FINISHED_RUN = 'Fin_Run',
    SHOW_SCORE = 'Score',
    CHAT = 'Chat',
    GAME_WIN = 'Win',
    MAP_SELECT = 'M_Sel',       // 玩家选择地图
    MAP_VOTES = 'M_Votes',      // 广播所有玩家的地图投票
    MAP_CHOSEN = 'M_Chosen'     // 最终选中的地图
}

export interface ChatPayload {
    nickname: string;
    message: string;
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
    selectedMap?: string; // 玩家选择的地图
}
