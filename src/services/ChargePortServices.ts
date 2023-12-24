import { Service } from "homebridge";
import { VehicleData } from "../util/types";
import { wait } from "../util/wait";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class ChargePortService extends TeslaPluginService {
  static serviceName = "Charge Port";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);

    this.service = new context.hap.Service.LockMechanism(this.getFullName(), "chargePort");

    this.bind("LockCurrentState", {
      getter: this.getCurrentState,
    });

    this.bind("LockTargetState", {
      getter: this.getTargetState,
      setter: this.setTargetState,
    });
  }

  getCurrentState(data: VehicleData | null): number {
    const { hap } = this.context;

    // Assume locked when not connected.
    const open = data ? data.charge_state.charge_port_latch === "Disengaged" : false;

    return open
      ? hap.Characteristic.LockCurrentState.UNSECURED
      : hap.Characteristic.LockCurrentState.SECURED;
  }

  getTargetState(data: VehicleData | null): number {
    const { hap } = this.context;

    const currentState = this.getCurrentState(data);

    return currentState === hap.Characteristic.LockCurrentState.SECURED
      ? hap.Characteristic.LockTargetState.SECURED
      : hap.Characteristic.LockTargetState.UNSECURED;
  }

  async setTargetState(state: number) {
    const { service } = this;
    const { log, tesla, hap } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      const open = state === hap.Characteristic.LockTargetState.UNSECURED;

      if (open) {
        log("Opening charge port.");
        await tesla.api("openChargePort", options);
      } else {
        log("Closing charge port.");
        await tesla.api("closeChargePort", options);
      }
    });

    // We need to update the current state "later" because Siri can't
    // handle receiving the change event inside the same "set target state"
    // response.
    await wait(1);

    if (state == hap.Characteristic.LockTargetState.SECURED) {
      service.setCharacteristic(
        hap.Characteristic.LockCurrentState,
        hap.Characteristic.LockCurrentState.SECURED,
      );
    } else {
      service.setCharacteristic(
        hap.Characteristic.LockCurrentState,
        hap.Characteristic.LockCurrentState.UNSECURED,
      );
    }
  }
}
