import { PlayerInfo } from "../network/Protocol";

/**
 * 分数明细项
 */
export interface ScoreBreakdown {
  type: string;
  points: number;
  color: string;
}

/**
 * 玩家分数结果
 */
export interface PlayerScoreResult {
  nickname: string;
  current: number;
  added: number;
  breakdown: ScoreBreakdown[];
}

/**
 * 分数管理器：管理游戏分数计算和统计
 */
export class ScoreManager {
  // 分数常量
  public static readonly GOAL_POINTS = 15; // 终点得分
  public static readonly SOLO_POINTS = 10; // 独行得分
  public static readonly FIRST_POINTS = 5; // 第一得分
  public static readonly TRAP_KILL_POINTS = 5; // 陷阱得分
  public static readonly GOAL_SCORE = 50; // 胜利所需总分

  // 回合追踪
  private finishOrder: string[] = [];
  private trapKills: Map<string, number> = new Map();

  /**
   * 记录玩家到达终点
   */
  public recordFinish(playerId: string): void {
    if (!this.finishOrder.includes(playerId)) {
      this.finishOrder.push(playerId);
    }
  }

  /**
   * 记录陷阱击杀
   */
  public recordTrapKill(killerId: string): void {
    const currentKills = this.trapKills.get(killerId) || 0;
    this.trapKills.set(killerId, currentKills + 1);
  }

  /**
   * 检查玩家是否已到达终点
   */
  public hasFinished(playerId: string): boolean {
    return this.finishOrder.includes(playerId);
  }

  /**
   * 获取完成玩家数量
   */
  public getFinishCount(): number {
    return this.finishOrder.length;
  }

  /**
   * 获取第一个完成的玩家
   */
  public getFirstFinisher(): string | null {
    return this.finishOrder.length > 0 ? this.finishOrder[0] : null;
  }

  /**
   * 获取玩家的击杀数
   */
  public getKillCount(playerId: string): number {
    return this.trapKills.get(playerId) || 0;
  }

  /**
   * 计算所有玩家的分数
   */
  public calculateScores(
    players: PlayerInfo[],
    _localPlayerId: string,
    getPlayerById: (id: string) => { hasWon?: boolean } | undefined
  ): PlayerScoreResult[] {
    const results: PlayerScoreResult[] = [];

    const winnersCount = this.finishOrder.length;
    const totalPlayers = players.length;
    const allReachedGoal = winnersCount === totalPlayers && totalPlayers > 0;

    players.forEach((p) => {
      const player = getPlayerById(p.id);
      if (player) {
        const scoreBreakdown: ScoreBreakdown[] = [];

        // 1. 终点得分：如果不是所有人都到达终点，到达的玩家得分
        const reachedGoal = this.finishOrder.includes(p.id);
        if (reachedGoal && !allReachedGoal) {
          scoreBreakdown.push({
            type: "Goal",
            points: ScoreManager.GOAL_POINTS,
            color: "#4CAF50",
          });
        }

        // 2. 独行得分：只有一个人到达终点
        if (winnersCount === 1 && this.finishOrder[0] === p.id) {
          scoreBreakdown.push({
            type: "Solo",
            points: ScoreManager.SOLO_POINTS,
            color: "#2196F3",
          });
        }

        // 3. 第一得分：多人到达终点时，第一个到达的获得奖励
        if (winnersCount > 1 && this.finishOrder[0] === p.id) {
          scoreBreakdown.push({
            type: "First",
            points: ScoreManager.FIRST_POINTS,
            color: "#FF9800",
          });
        }

        // 4. 陷阱得分：每次击杀得分
        const kills = this.trapKills.get(p.id) || 0;
        if (kills > 0) {
          scoreBreakdown.push({
            type: "Trap",
            points: kills * ScoreManager.TRAP_KILL_POINTS,
            color: "#E91E63",
          });
        }

        // 计算总新增分数
        const added = scoreBreakdown.reduce((sum, s) => sum + s.points, 0);

        // 更新总分
        if (!(p as any).totalScore) (p as any).totalScore = 0;
        (p as any).totalScore += added;

        results.push({
          nickname: p.nickname,
          current: (p as any).totalScore,
          added: added,
          breakdown: scoreBreakdown,
        });
      }
    });

    return results;
  }

  /**
   * 检查是否有赢家
   */
  public checkWinner(
    scores: PlayerScoreResult[]
  ): PlayerScoreResult | undefined {
    return scores.find((s) => s.current >= ScoreManager.GOAL_SCORE);
  }

  /**
   * 重置回合数据
   */
  public resetRound(): void {
    this.finishOrder = [];
    this.trapKills.clear();
  }

  /**
   * 重置所有数据（新游戏）
   */
  public resetAll(players: PlayerInfo[]): void {
    this.resetRound();
    players.forEach((p) => {
      (p as any).totalScore = 0;
    });
  }
}
