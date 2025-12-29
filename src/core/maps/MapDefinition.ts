import { PhysicsWorld } from "../../physics/PhysicsWorld";
import { Resources } from "../Resources";
import * as THREE from "three";

/**
 * 地图定义接口
 */
export interface MapDefinition {
  id: string;
  name: string;
  description: string;
  previewColor: number; // 预览背景色
  skyColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
}

/**
 * 地图构建器接口
 */
export interface MapBuilder {
  definition: MapDefinition;
  
  /**
   * 构建地图
   */
  build(
    scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    resources: Resources,
    mapRoot: THREE.Group
  ): void;
  
  /**
   * 更新地图（用于动画等）
   */
  update?(time: number): void;
  
  /**
   * 清理地图资源
   */
  cleanup?(): void;
}

/**
 * 地图构建器类型
 */
export type MapBuilderConstructor = new () => MapBuilder;

/**
 * Available map list
 */
export const MAP_LIST: MapDefinition[] = [
  {
    id: "enchanted_forest",
    name: "Enchanted Forest",
    description: "Journey through an ancient forest, jumping across stumps and rocks",
    previewColor: 0x228b22,
    skyColor: 0x87ceeb,
    fogColor: 0x9dd5e8,
    fogNear: 50,
    fogFar: 120,
  },
  {
    id: "ice_kingdom",
    name: "Ice Kingdom",
    description: "Traverse the frozen world, watch out for slippery surfaces",
    previewColor: 0x87ceeb,
    skyColor: 0xb0e0e6,
    fogColor: 0xc5e8f0,
    fogNear: 40,
    fogFar: 100,
  },
  {
    id: "volcano_island",
    name: "Volcano Island",
    description: "Cross the volcanic terrain, avoid the lava",
    previewColor: 0xff4500,
    skyColor: 0x2a1a0a,
    fogColor: 0x3a2010,
    fogNear: 30,
    fogFar: 90,
  },
];

/**
 * 地图注册表 - 动态导入地图构建器
 */
let mapRegistry: Map<string, MapBuilderConstructor> | null = null;

export async function getMapRegistry(): Promise<Map<string, MapBuilderConstructor>> {
  if (mapRegistry) return mapRegistry;
  
  mapRegistry = new Map();
  
  const { EnchantedForestMap } = await import("./EnchantedForestMap");
  const { IceKingdomMap } = await import("./IceKingdomMap");
  const { VolcanoIslandMap } = await import("./VolcanoIslandMap");
  
  mapRegistry.set("enchanted_forest", EnchantedForestMap);
  mapRegistry.set("ice_kingdom", IceKingdomMap);
  mapRegistry.set("volcano_island", VolcanoIslandMap);
  
  return mapRegistry;
}

/**
 * 获取地图构建器
 */
export async function getMapBuilder(mapId: string): Promise<MapBuilder | null> {
  const registry = await getMapRegistry();
  const BuilderClass = registry.get(mapId);
  if (BuilderClass) {
    return new BuilderClass();
  }
  return null;
}

/**
 * 获取地图定义
 */
export function getMapDefinition(mapId: string): MapDefinition | undefined {
  return MAP_LIST.find(m => m.id === mapId);
}
