import { Service } from "homebridge";
import { wait } from "../util/wait";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class TestService extends TeslaPluginService {
  static serviceName = "Test";
  service: Service;

  state: "online" | "offline" = "offline";

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Switch(this.getFullName());

    this.bind("On", {
      getter: this.getOn,
      setter: this.setOn,
      fallbackValue: false,
    });
  }

  async getOn() {
    await wait(1000);

    return this.state === "online";
  }

  async setOn(on: boolean) {
    this.context.log.info(`Setting vehicle connection to ${on ? "on" : "off"}.`);
    this.context.log.info(`Sleeping`);
    await wait(1000);
    this.context.log.info(`Slept`);

    this.state = on ? "online" : "offline";
  }
}
