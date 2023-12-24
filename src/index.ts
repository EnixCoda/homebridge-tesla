require("@babel/polyfill");
import { API, Logging, PlatformAccessory, PlatformConfig, Service } from "homebridge";
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
import { FrontTrunkService, RearTrunkService } from "./services/TrunkService";
import { VehicleLockService } from "./services/VehicleLockService";
import { TeslaApi } from "./util/api";
import { getConfigValue, TeslaPluginConfig } from "./util/types";

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

    private enableService(Service: typeof TeslaPluginService, keys?: (keyof TeslaPluginConfig)[]) {
      if (!keys || keys.every((key) => getConfigValue(this.context.config, key))) {
        this.addAccessory(new (Service as typeof DummyService)(this.context));
      }
    }

    private setup(config: TeslaPluginConfig) {
      this.api.on("didFinishLaunching", () => {
        const bindings = [
          [ConnectionService],
          [BatteryService],
          [VehicleLockService, ["vehicleLock"]],
          [RearTrunkService, ["trunk"]],
          [FrontTrunkService, ["frontTrunk"]],
          [SteeringWheelHeaterService, ["steeringWheelHeater"]],
          [ChargeLimitService, ["chargeLimit"]],
          [ChargeLevelService, ["chargeLevel"]],
          [ChargePortService, ["chargePort"]],
          [ChargerService, ["charger"]],
          [ChargingAmpsService, ["chargingAmps"]],
          [DefrostService, ["defrost"]],
          [SentryModeService, ["sentryMode"]],
          [StarterService, ["starter"]],
          [HomeLinkService, ["homeLink", "latitude", "longitude"]],
          [
            getConfigValue(config, "climateSwitch") ? ClimateSwitchService : ClimateService,
            ["climate"],
          ],
        ] as [typeof TeslaPluginService, (keyof TeslaPluginConfig)[]][];
        bindings.forEach(([Service, keys]) => this.enableService(Service, keys));

        this.tesla.getVehicleData();
      });
    }
  }

  api.registerPlatform(pluginIdentifier, platformName, TeslaPlatformPlugin);

  class DummyService extends TeslaPluginService {
    public service: Service;
    name = "DummyService";
    constructor(context: TeslaPluginServiceContext) {
      super(context);
      throw new Error("DummyService should not be instantiated");
    }
  }
}
