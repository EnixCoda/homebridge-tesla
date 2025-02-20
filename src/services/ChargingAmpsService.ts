import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class ChargingAmpsService extends TeslaPluginService {
  static serviceName = "Charging Amps";
  service: Service;

  // We need to set charging amps on a delay because the UX in the Home app is
  // a lightbulb brightness slider that is "realtime" - so we will be told
  // to change the charge level even as the user is dragging the slider around.
  // We don't want to issue a million API commands so we'll wait a bit before
  // actually sending the command.
  setAmpsTimeoutId: NodeJS.Timeout | null = null;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.Lightbulb(this.getFullName(), "chargingAmps");

    this.bind("On", {
      getter: this.getOn,
    });

    const brightness = this.service
      .addCharacteristic(this.context.hap.Characteristic.Brightness)
      .on("get", this.createGetter(this.getLevel))
      .on("set", this.createSetter(this.setLevel));
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
    // Show 0% when not connected and no last-known state.
    return data ? data.charge_state.charge_current_request : 0;
  }

  async setLevel(value: number) {
    if (this.setAmpsTimeoutId) {
      clearTimeout(this.setAmpsTimeoutId);
    }

    // Set it in 2 seconds.
    this.setAmpsTimeoutId = setTimeout(() => {
      this.actuallySetLevel(value);
    }, 2000);
  }

  async actuallySetLevel(value: number) {
    const { log, tesla } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      log(`Setting charging amps to ${value}…`);
      await tesla.api("setChargingAmps", options, value);
    });
  }
}
