/**
 * 聊天系统组件
 */
export class ChatSystem {
  private chatContainer: HTMLElement;
  private chatHistory: HTMLElement;
  private chatInputContainer: HTMLElement;
  private chatInput: HTMLInputElement;
  private isChatOpen: boolean = false;
  private onChatSend: ((message: string) => void) | null = null;

  constructor() {
    // 创建聊天容器
    this.chatContainer = document.createElement("div");
    this.chatContainer.className = "chat-container";

    // 聊天历史
    this.chatHistory = document.createElement("div");
    this.chatHistory.className = "chat-history";
    this.chatContainer.appendChild(this.chatHistory);

    // 输入容器
    this.chatInputContainer = document.createElement("div");
    this.chatInputContainer.className = "chat-input-container";

    this.chatInput = document.createElement("input");
    this.chatInput.type = "text";
    this.chatInput.className = "chat-input";
    this.chatInput.placeholder = "Type a message...";
    this.chatInput.maxLength = 200;

    this.chatInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        this.sendMessage();
      } else if (e.key === "Escape") {
        this.close();
      }
    });

    this.chatInputContainer.appendChild(this.chatInput);
    this.chatContainer.appendChild(this.chatInputContainer);

    document.body.appendChild(this.chatContainer);
  }

  public setCallback(callback: (message: string) => void): void {
    this.onChatSend = callback;
  }

  public open(): void {
    if (this.isChatOpen) return;
    this.isChatOpen = true;
    this.chatInputContainer.classList.add("active");
    this.chatInput.focus();
  }

  public close(): void {
    this.isChatOpen = false;
    this.chatInputContainer.classList.remove("active");
    this.chatInput.value = "";
    this.chatInput.blur();
  }

  public isOpen(): boolean {
    return this.isChatOpen;
  }

  private sendMessage(): void {
    if (!this.chatInput.value.trim()) {
      this.close();
      return;
    }

    const message = this.chatInput.value.trim();
    if (this.onChatSend) {
      this.onChatSend(message);
    }
    this.close();
  }

  public addMessage(nickname: string, message: string, color?: string): void {
    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-message";

    const nickSpan = document.createElement("span");
    nickSpan.className = "nickname";
    nickSpan.textContent = nickname + ":";
    // 使用玩家颜色，如果没有提供则使用默认颜色
    if (color) {
      nickSpan.style.color = color;
    }
    msgDiv.appendChild(nickSpan);

    const textSpan = document.createElement("span");
    textSpan.textContent = message;
    msgDiv.appendChild(textSpan);

    this.chatHistory.appendChild(msgDiv);
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;

    // 限制历史消息数量
    while (this.chatHistory.children.length > 50) {
      this.chatHistory.removeChild(this.chatHistory.firstChild!);
    }
  }
}
