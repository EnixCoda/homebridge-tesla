import { Service } from "homebridge";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class ConnectionService extends TeslaPluginService {
  static serviceName = "Connection";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Switch(this.getFullName(), "connection");

    this.bind("On", {
      getter: this.getOn,
      setter: this.setOn,
    });
  }

  async getOn() {
    const { tesla } = this.context;

    const { state } = await tesla.getVehicle();
    const on = state === "online";

    return on;
  }

  async setOn(on: boolean) {
    const { log, tesla } = this.context;

    if (on) {
      const options = await tesla.getOptions();
      await tesla.wakeUp(options);

      // Force a refresh of the vehicle data which will cause all services
      // to update HomeKit with the latest state.
      await tesla.getVehicleData({ ignoreCache: true });
    } else {
      log("Ignoring request to put vehicle to sleep, we can't do that!");
    }
  }
}
