import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { EnvySecurityPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class Task {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private on = false;


  constructor(
    private readonly platform: EnvySecurityPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)?.
      setCharacteristic(this.platform.Characteristic.Manufacturer, 'Envy')
      .setCharacteristic(this.platform.Characteristic.Model, 'Task')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the Switch service if it exists, otherwise create a new Switch service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Switch

    // create handlers for required characteristics
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.handleOnGet.bind(this))
      .onSet(this.handleOnSet.bind(this));

  }

  /**
   * Handle requests to get the current value of the "On" characteristic
   */
  handleOnGet() : false {
    //this.accessory.context.device.log.debug('handleOnGet:', this.on);

    // set this to a valid value for On
    return false;
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  handleOnSet(value: CharacteristicValue) : void {
    value = Boolean(value)
    //this.accessory.context.device.log.debug('handleOnSet:', value);

    if (value) {
      this.on = value;
      this.platform.client.write('Security_system::ActivateTask(TaskNumber = ' + this.getId() + ')\n');
      this.doUpdate();
    }
  }

  doUpdate() : void {
    //this.platform.log.info(this.getId() +' - doUpdate: ');

    const on = this.on;
    //this.platform.log.info('on:', on);

    if (on) {
      this.service.getCharacteristic(this.platform.Characteristic.On).setValue(false);
    }
  }

  getId() : number {
    return this.accessory.context.device.id;
  }
}
