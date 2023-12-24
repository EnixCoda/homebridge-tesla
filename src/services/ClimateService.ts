import { CharacteristicValue, Service } from "homebridge";
import { getConfigValue, VehicleData } from "../util/types";
import { TeslaPluginService, TeslaPluginServiceContext } from "./TeslaPluginService";

export class ClimateService extends TeslaPluginService {
  static serviceName = "Climate";
  service: Service;

  constructor(context: TeslaPluginServiceContext) {
    super(context);
    const { hap } = context;

    this.service = new hap.Service.Thermostat(this.getFullName(), "climate");

    // Apply desired temp units from config.
    this.bind("TemperatureDisplayUnits", {
      getter: () =>
        getConfigValue(context.config, "celsius")
          ? hap.Characteristic.TemperatureDisplayUnits.CELSIUS
          : hap.Characteristic.TemperatureDisplayUnits.FAHRENHEIT,
    });

    this.bind("CurrentHeatingCoolingState", {
      getter: this.getCurrentState,
    });

    this.bind("TargetHeatingCoolingState", {
      getter: this.getTargetState,
      setter: this.setTargetState,
    });

    this.bind("CurrentTemperature", {
      getter: this.getCurrentTemperature,
    });

    this.bind("TargetTemperature", {
      getter: this.getTargetTemp,
      setter: this.setTargetTemp,
    });
  }

  getCurrentState(data: VehicleData | null): CharacteristicValue {
    const { hap } = this.context;

    // Assume off when not connected.
    const on = data ? data.climate_state.is_climate_on : false;

    // If it's on, see what direction the temp should be moving.
    if (data && on) {
      const { driver_temp_setting, inside_temp } = data.climate_state;
      if (driver_temp_setting >= inside_temp) {
        return hap.Characteristic.CurrentHeatingCoolingState.HEAT;
      } else if (driver_temp_setting < inside_temp) {
        return hap.Characteristic.CurrentHeatingCoolingState.COOL;
      }
    }

    return hap.Characteristic.CurrentHeatingCoolingState.OFF;
  }

  getTargetState(data: VehicleData | null): CharacteristicValue {
    const { hap } = this.context;

    const currentState = this.getCurrentState(data);

    if (currentState === hap.Characteristic.CurrentHeatingCoolingState.HEAT) {
      return hap.Characteristic.TargetHeatingCoolingState.HEAT;
    } else if (currentState === hap.Characteristic.CurrentHeatingCoolingState.COOL) {
      return hap.Characteristic.TargetHeatingCoolingState.COOL;
    }

    return hap.Characteristic.TargetHeatingCoolingState.OFF;
  }

  async setTargetState(value: CharacteristicValue) {
    const { log, hap, tesla } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      if (value === hap.Characteristic.TargetHeatingCoolingState.OFF) {
        log("Turning off climate control…");
        await tesla.api("climateStop", options);
      } else {
        log("Turning on climate control…");
        await tesla.api("climateStart", options);
      }
    });
  }

  getCurrentTemperature(data: VehicleData | null): CharacteristicValue {
    return data?.climate_state.inside_temp ?? 10;
  }

  getTargetTemp(data: VehicleData | null): number {
    return data?.climate_state.driver_temp_setting ?? 10;
  }

  async setTargetTemp(value: number) {
    const { log, tesla } = this.context;

    await tesla.wakeAndCommand(async (options) => {
      log(`Setting climate temperature to ${this.formatTemp(value)}…`);
      await tesla.api("setTemps", options, value, value);
    });
  }

  formatTemp(value: number): string {
    const { service, context } = this;
    const { hap } = context;

    const units = service.getCharacteristic(hap.Characteristic.TemperatureDisplayUnits).value;

    if (units === hap.Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
      // Value is always in celsius, so convert to F for display.
      return `${Math.round(value * 1.8 + 32)}°F`;
    } else {
      return `${value}°C`;
    }
  }
}
