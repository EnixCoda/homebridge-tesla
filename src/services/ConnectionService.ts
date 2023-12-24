import { Service } from "homebridge";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class ConnectionService extends TeslaPluginService {
  static serviceName = "Connection";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Switch(this.getFullName());

    this.bind("On", {
      getter: this.getOn,
      setter: this.setOn,
    });

    // TODO: turn off when vehicle goes to sleep
  }

  async getOn() {
    return (await this.context.tesla.getVehicle())?.state === "online";
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
      log("Ignoring request to put vehicle to sleep, we can't do that! Reverting to On");
      this.service.getCharacteristic(this.context.hap.Characteristic.On).updateValue(true);
    }
  }
}
