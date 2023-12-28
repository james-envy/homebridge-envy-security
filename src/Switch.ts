import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { EnvySecurityPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class Switch {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private on = false;

  private zoneState = false;
  private outputState = false;

  private waiting = false;
  private timeout;


  constructor(
    private readonly platform: EnvySecurityPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)?.
      setCharacteristic(this.platform.Characteristic.Manufacturer, 'Envy')
      .setCharacteristic(this.platform.Characteristic.Model, 'Switch')
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
  handleOnGet() : boolean {
    //this.accessory.context.device.log.debug('handleOnGet:', this.on);

    // set this to a valid value for On
    return this.on;
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  handleOnSet(value : CharacteristicValue) : void {
    value = Boolean(value)
    //this.accessory.context.device.log.debug('handleOnSet:', value);
    //this.accessory.context.device.log.debug('Zone:', this.accessory.context.device.zone);

    if (this.on !== value) {
      this.on = value;
      //this.accessory.context.device.log.debug('On: ', this.accessory.context.device.on);
      //this.accessory.context.device.log.debug('Duration: ', this.accessory.context.device.duration);
      const duration = this.accessory.context.device.duration;
      if (((duration === undefined) && !value) || this.waiting) {
        if (this.waiting === true) {
          clearTimeout(this.timeout);
          this.waiting = false;
        }
        this.platform.client.write('Security_system::OutputOff(OutputNumber = ' + this.getId() + ')\n');
      } else if (((duration === undefined) && value) || !this.waiting) {
        for (const output in this.platform.zone_outputs[this.accessory.context.device.zone]) {
          if (Number(output) !== this.getId()) {
            this.platform.outputs[output].abort();
          }
        }
        this.platform.client.write('Security_system::OutputOn(OutputNumber = ' + this.getId() + ')\n');
        if (duration !== undefined) {
          this.waiting = true;
          this.timeout = setTimeout(() => this.stopWaiting(this), duration * 1000);
        }
      }
      this.doUpdate();
    }
  }

  stopWaiting(_this: this) : void {
    //_this.platform.log.info(this.getId() +' - stopWaiting');
    _this.waiting = false;
    if (this.outputState !== false) {
      this.platform.client.write('Security_system::OutputOff(OutputNumber = ' + this.getId() + ')\n');
    }
    _this.doUpdate();
  }

  setZoneState(state: boolean) : void {
    //this.platform.log.info(this.getId() +' - setZoneState:', state);
    if (state !== this.zoneState) {
      this.zoneState = state;
      this.doUpdate();
    }
  }

  setOutputState(state: boolean) : void {
    //this.platform.log.info(this.getId() +' - setOutputState:', state);
    if (state !== this.outputState) {
      this.outputState = state;
      if ((this.accessory.context.device.zone === undefined) || (this.accessory.context.device.zone === 0)) {
        this.zoneState = state;
      }
      this.doUpdate();
    }
  }

  abort() : void {
    if (this.waiting === true) {
      clearTimeout(this.timeout);
      this.waiting = false;
    }
    this.platform.client.write('Security_system::OutputOff(OutputNumber = ' + this.getId() + ')\n');
  }

  doUpdate() : void {
    //this.platform.log.info(this.getId() +' - doUpdate: ' + (this.waiting ? '' : '!') + 'waiting');
    let on;

    if (this.waiting) {
      on = this.on;
    } else {
      //this.accessory.context.device.log.info('Duration: ', this.accessory.context.device.duration);
      //this.platform.log.info('zoneState:', this.zoneState);
      //this.platform.log.info('outputState:', this.outputState);
      on = this.zoneState;
    }
    //this.platform.log.info('on:', on);

    if (on !== this.on) {
      this.on = on;
      this.service.getCharacteristic(this.platform.Characteristic.On).setValue(on);
    }
  }

  getId() : number {
    return this.accessory.context.device.id;
  }
}
