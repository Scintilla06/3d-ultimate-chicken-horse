/**
 * Score Result Data
 */
export interface ScoreData {
  nickname: string;
  current: number;
  added: number;
  breakdown?: { type: string; points: number; color: string }[];
}

/**
 * Score Screen Component
 */
export class ScoreScreen {
  private uiLayer: HTMLElement;

  constructor(uiLayer: HTMLElement) {
    this.uiLayer = uiLayer;
  }

  public show(
    scores: ScoreData[],
    goalScore: number,
    onComplete: () => void
  ): void {
    this.uiLayer.innerHTML = "";

    // 核心尺寸定义
    const PX_PER_POINT = 10;
    const MAX_POINTS = 60;
    const BAR_WIDTH = MAX_POINTS * PX_PER_POINT;
    const GOAL_POS = goalScore * PX_PER_POINT;
    const ROW_HEIGHT = 50;
    const ROW_GAP = 20;
    const NAME_WIDTH = 120;

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "50%";
    container.style.left = "50%";
    container.style.transform = "translate(-50%, -50%)";
    container.style.backgroundColor = "#e8dcc8";
    container.style.padding = "40px";
    container.style.borderRadius = "0";
    container.style.color = "#333";
    container.style.fontFamily =
      '"Comic Sans MS", "Chalkboard SE", sans-serif';

    const title = document.createElement("h2");
    title.innerText = "Round Results";
    title.style.textAlign = "center";
    title.style.marginBottom = "30px";
    title.style.color = "#333";
    container.appendChild(title);

    const chartContainer = document.createElement("div");
    chartContainer.style.position = "relative";
    chartContainer.style.marginLeft = `${NAME_WIDTH}px`;
    chartContainer.style.width = `${BAR_WIDTH}px`;
    container.appendChild(chartContainer);

    // 刻度线
    for (let p = 10; p <= MAX_POINTS; p += 10) {
      const tick = document.createElement("div");
      tick.style.position = "absolute";
      tick.style.left = `${p * PX_PER_POINT}px`;
      tick.style.top = "0";
      tick.style.bottom = "0";
      tick.style.width = "1px";
      tick.style.borderLeft = "2px dashed #999";
      tick.style.zIndex = "5";
      chartContainer.appendChild(tick);

      const label = document.createElement("div");
      label.innerText = `${p / 10}`;
      label.style.position = "absolute";
      label.style.left = `${p * PX_PER_POINT}px`;
      label.style.bottom = "-25px";
      label.style.transform = "translateX(-50%)";
      label.style.fontSize = "14px";
      label.style.color = "#666";
      chartContainer.appendChild(label);
    }

    // GOAL 线
    const goalLine = document.createElement("div");
    goalLine.style.position = "absolute";
    goalLine.style.left = `${GOAL_POS}px`;
    goalLine.style.top = "0";
    goalLine.style.bottom = "0";
    goalLine.style.width = "3px";
    goalLine.style.backgroundColor = "#333";
    goalLine.style.zIndex = "15";
    chartContainer.appendChild(goalLine);

    const playerColors = ["#3b5998", "#e07020", "#2a9d4a", "#9b59b6"];

    // 收集所有得分类型
    const allScoreTypes: string[] = [];
    scores.forEach((s) => {
      if (s.breakdown) {
        s.breakdown.forEach((b) => {
          if (!allScoreTypes.includes(b.type)) {
            allScoreTypes.push(b.type);
          }
        });
      }
    });

    // 每个玩家的行
    scores.forEach((s, i) => {
      const rowTop = i * (ROW_HEIGHT + ROW_GAP);
      const baseColor = playerColors[i % playerColors.length];

      // 名字
      const name = document.createElement("div");
      name.innerText = s.nickname;
      name.style.position = "absolute";
      name.style.left = `-${NAME_WIDTH}px`;
      name.style.top = `${rowTop}px`;
      name.style.width = `${NAME_WIDTH - 10}px`;
      name.style.height = `${ROW_HEIGHT}px`;
      name.style.lineHeight = `${ROW_HEIGHT}px`;
      name.style.textAlign = "right";
      name.style.fontWeight = "bold";
      name.style.fontSize = "16px";
      name.style.color = "#333";
      chartContainer.appendChild(name);

      // 基础分数条
      const baseScore = s.current - s.added;
      let currentLeft = 0;

      if (baseScore > 0) {
        const baseBar = document.createElement("div");
        baseBar.style.position = "absolute";
        baseBar.style.left = "0";
        baseBar.style.top = `${rowTop}px`;
        baseBar.style.width = `${baseScore * PX_PER_POINT}px`;
        baseBar.style.height = `${ROW_HEIGHT}px`;
        baseBar.style.backgroundColor = baseColor;
        baseBar.style.backgroundImage = `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 4px,
          rgba(255,255,255,0.3) 4px,
          rgba(255,255,255,0.3) 8px
        )`;
        baseBar.style.border = `2px solid ${baseColor}`;
        baseBar.style.boxSizing = "border-box";
        chartContainer.appendChild(baseBar);
        currentLeft = baseScore * PX_PER_POINT;
      }

      // 新增分数条
      if (s.breakdown && s.breakdown.length > 0) {
        let accumulatedLeft = currentLeft;

        s.breakdown.forEach((scoreItem, scoreIndex) => {
          const typeIndex = allScoreTypes.indexOf(scoreItem.type);
          const animDelay = typeIndex * 800 + 300;

          const addedBar = document.createElement("div");
          addedBar.style.position = "absolute";
          addedBar.style.left = `${accumulatedLeft}px`;
          addedBar.style.top = `${rowTop}px`;
          addedBar.style.width = "0px";
          addedBar.style.height = `${ROW_HEIGHT}px`;
          addedBar.style.backgroundColor = scoreItem.color;
          addedBar.style.backgroundImage = `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 4px,
            rgba(255,255,255,0.3) 4px,
            rgba(255,255,255,0.3) 8px
          )`;
          addedBar.style.border = `2px solid ${scoreItem.color}`;
          addedBar.style.boxSizing = "border-box";
          addedBar.style.transition =
            "width 0.6s ease-out, opacity 0.1s ease-out";
          addedBar.style.zIndex = `${10 - scoreIndex}`;
          addedBar.style.opacity = "0";
          chartContainer.appendChild(addedBar);

          setTimeout(() => {
            addedBar.style.opacity = "1";
            addedBar.style.width = `${scoreItem.points * PX_PER_POINT}px`;
          }, animDelay);

          accumulatedLeft += scoreItem.points * PX_PER_POINT;
        });
      }
    });

    // 类型标签容器
    const labelContainer = document.createElement("div");
    labelContainer.style.position = "relative";
    labelContainer.style.marginTop = "20px";
    labelContainer.style.textAlign = "center";
    labelContainer.style.minHeight = "30px";
    container.appendChild(labelContainer);

    allScoreTypes.forEach((type, index) => {
      setTimeout(() => {
        labelContainer.innerHTML = "";
        const typeLabel = document.createElement("span");
        typeLabel.innerText = `+ ${type}`;
        typeLabel.style.fontSize = "24px";
        typeLabel.style.fontWeight = "bold";
        const typeColors: { [key: string]: string } = {
          Goal: "#4CAF50",
          Solo: "#2196F3",
          First: "#FF9800",
          Trap: "#E91E63",
        };
        typeLabel.style.color = typeColors[type] || "#333";
        labelContainer.appendChild(typeLabel);
      }, index * 800 + 300);
    });

    // 设置图表容器高度
    const totalHeight = scores.length * (ROW_HEIGHT + ROW_GAP);
    chartContainer.style.height = `${totalHeight}px`;
    chartContainer.style.marginBottom = "40px";

    this.uiLayer.appendChild(container);

    // 动画完成后回调
    const totalAnimTime = allScoreTypes.length * 800 + 1500;
    setTimeout(() => {
      onComplete();
    }, totalAnimTime);
  }
}
