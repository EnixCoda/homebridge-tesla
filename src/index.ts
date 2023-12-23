require("@babel/polyfill");
import { API, Logging, PlatformAccessory, PlatformConfig } from "homebridge";
import { BatteryService } from "./services/BatteryService";
import { ChargeLevelService } from "./services/ChargeLevelService";
import { ChargeLimitService } from "./services/ChargeLimitService";
import { ChargePortService } from "./services/ChargePortServices";
import { ChargerService } from "./services/ChargerService";
import { ChargingAmpsService } from "./services/ChargingAmpsService";
import { ClimateService } from "./services/ClimateService";
import { ClimateSwitchService } from "./services/ClimateSwitchService";
import { ConnectionService } from "./services/ConnectionService";
import { DefrostService } from "./services/DefrostService";
import { HomeLinkService } from "./services/HomeLinkService";
import { SentryModeService } from "./services/SentryModeService";
import { StarterService } from "./services/StarterService";
import { SteeringWheelHeaterService } from "./services/SteeringWheelHeaterService";
import { TeslaPluginService, TeslaPluginServiceContext } from "./services/TeslaPluginService";
import { FrontTrunk, RearTrunk, TrunkService } from "./services/TrunkService";
import { VehicleLockService } from "./services/VehicleLockService";
import { TeslaApi } from "./util/api";
import { TeslaPluginConfig, getConfigValue } from "./util/types";

const pluginIdentifier = "homebridge-enixcoda-tesla";
const platformName = "EnixCodaTesla";

export default function (api: API) {
  class TeslaPlatformPlugin {
    tesla: TeslaApi;
    context: TeslaPluginServiceContext;
    accessories: PlatformAccessory[] = [];

    constructor(
      log: Logging,
      platformConfig: PlatformConfig,
      public api: API,
    ) {
      const { platform, name, _bridge, ...restConfig } = platformConfig;
      const teslaPluginConfig = restConfig as TeslaPluginConfig;
      const tesla = new TeslaApi(log, teslaPluginConfig);

      this.tesla = tesla;
      this.context = { log, hap: api.hap, config: teslaPluginConfig, tesla };

      this.setup(teslaPluginConfig);

      tesla.getVehicleData();
    }

    configureAccessory(accessory: PlatformAccessory) {
      this.accessories.push(accessory);
    }

    private addAccessory(pluginService: TeslaPluginService) {
      const accessoryName = pluginService.name;
      if (accessoryName === null) {
        throw new Error(`Service name of ${pluginService.constructor.name} is null`);
      }
      const uuid = api.hap.uuid.generate([platformName, accessoryName].join("/"));

      // check the accessory was not restored from cache
      const accessory = this.accessories.find((accessory) => accessory.UUID === uuid);
      if (accessory) {
        return accessory;
      } else {
        // create a new accessory
        const accessory = new this.api.platformAccessory(accessoryName, uuid);
        accessory.services.push(pluginService.service);

        // register the accessory
        this.api.registerPlatformAccessories(pluginIdentifier, platformName, [accessory]);
        this.accessories.push(accessory);
        return accessory;
      }
    }

    private setup(config: TeslaPluginConfig) {
      const { api, context } = this;

      api.on("didFinishLaunching", () => {
        this.addAccessory(new ConnectionService(context));
        this.addAccessory(new BatteryService(context));

        if (getConfigValue(config, "vehicleLock")) {
          this.addAccessory(new VehicleLockService(context));
        }

        if (getConfigValue(config, "trunk")) {
          this.addAccessory(new TrunkService(context, RearTrunk));
        }

        if (getConfigValue(config, "frontTrunk")) {
          this.addAccessory(new TrunkService(context, FrontTrunk));
        }

        if (getConfigValue(config, "climate")) {
          this.addAccessory(
            getConfigValue(config, "climateSwitch")
              ? new ClimateSwitchService(context)
              : new ClimateService(context),
          );
        }

        if (getConfigValue(config, "steeringWheelHeater")) {
          this.addAccessory(new SteeringWheelHeaterService(context));
        }

        if (getConfigValue(config, "chargeLimit")) {
          this.addAccessory(new ChargeLimitService(context));
        }

        if (getConfigValue(config, "chargeLevel")) {
          this.addAccessory(new ChargeLevelService(context));
        }

        if (getConfigValue(config, "chargePort")) {
          this.addAccessory(new ChargePortService(context));
        }

        if (getConfigValue(config, "charger")) {
          this.addAccessory(new ChargerService(context));
        }

        if (getConfigValue(config, "chargingAmps")) {
          this.addAccessory(new ChargingAmpsService(context));
        }

        if (getConfigValue(config, "defrost")) {
          this.addAccessory(new DefrostService(context));
        }

        if (getConfigValue(config, "sentryMode")) {
          this.addAccessory(new SentryModeService(context));
        }

        if (getConfigValue(config, "starter")) {
          this.addAccessory(new StarterService(context));
        }

        if (
          getConfigValue(config, "homeLink") &&
          getConfigValue(config, "latitude") &&
          getConfigValue(config, "longitude")
        ) {
          this.addAccessory(new HomeLinkService(context));
        }
      });
    }
  }

  api.registerPlatform(pluginIdentifier, platformName, TeslaPlatformPlugin);
}
