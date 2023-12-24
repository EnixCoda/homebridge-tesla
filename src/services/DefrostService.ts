import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class DefrostService extends TeslaPluginService {
  static serviceName = "Defrost";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Switch(this.getFullName(), "defrost");

    this.bind("On", {
      getter: this.getOn,
      setter: this.setOn,
    });
  }

  getOn(data: VehicleData | null) {
    // Assume off when not connected.
    return data ? !!data.climate_state.defrost_mode : false;
  }

  async setOn(on: boolean) {
    const { log, tesla } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      log(`Turning defrost ${on ? "on" : "off"}.`);
      await tesla.api("maxDefrost", options, on);
    });
  }
}
