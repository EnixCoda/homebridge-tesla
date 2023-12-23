import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class ChargeLevelService extends TeslaPluginService {
  service: Service;
  name = "Charge Level";

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Lightbulb(this.getFullName(), "chargeLevel");

    this.bind("On", { getter: this.getOn });

    const brightness = this.service
      .addCharacteristic(this.context.hap.Characteristic.Brightness)
      .on("get", this.createGetter(this.getLevel));

    context.tesla.on("vehicleDataUpdated", (data) => {
      brightness.updateValue(this.getLevel(data));
    });
  }

  getOn(data: VehicleData | null) {
    // Show off when not connected and no last-known state. Otherwise always
    // "on".
    return data ? true : false;
  }

  getLevel(data: VehicleData | null) {
    // Assume 50% when not connected and no last-known state.
    return data ? data.charge_state.battery_level : 50;
  }
}
