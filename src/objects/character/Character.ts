import * as CANNON from "cannon-es";
import { CharacterRig } from "./CharacterRig";
import { CharacterAnimState } from "./CharacterAppearance";

export class Character {
  public rig: CharacterRig;
  public body: CANNON.Body;
  protected animState: CharacterAnimState = "idle";

  constructor(rig: CharacterRig, body: CANNON.Body) {
    this.rig = rig;
    this.body = body;
  }

  public setAnimState(state: CharacterAnimState) {
    this.animState = state;
  }

  public update(delta: number) {
    this.rig.updateFromBody(this.body);
    this.rig.updateAnimation(delta, this.animState);
  }
}
