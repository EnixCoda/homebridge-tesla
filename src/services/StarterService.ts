import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class StarterService extends TeslaPluginService {
  static serviceName = "Starter";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Switch(this.getFullName(), "starter");

    this.bind("On", {
      getter: this.getOn,
      setter: this.setOn,
    });
  }

  getOn(data: VehicleData | null) {
    // Assume off when not connected.
    return data ? !!data.vehicle_state.remote_start : false;
  }

  async setOn(on: boolean) {
    const { log, tesla } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      if (on) {
        log("Enabling keyless driving.");
        await tesla.api("remoteStart", options);
      } else {
        log("Keyless driving cannot be disabled; ignoring.");
      }
    });
  }
}
