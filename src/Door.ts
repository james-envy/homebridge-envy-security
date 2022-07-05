import { Service, PlatformAccessory } from 'homebridge';

import { EnvySecurityPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class Door {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private currentPosition = 0;
  private targetPosition = 0;
  private positionState = 2;

  private zoneState = false;
  private outputState = false;

  private waiting = false;
  private timeout;


  constructor(
    private readonly platform: EnvySecurityPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Envy')
      .setCharacteristic(this.platform.Characteristic.Model, 'Door')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the Door service if it exists, otherwise create a new Door service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Door) ||
      this.accessory.addService(this.platform.Service.Door);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Door

    // create handlers for required characteristics
    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(this.handleCurrentPositionGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.PositionState)
      .onGet(this.handlePositionStateGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onGet(this.handleTargetPositionGet.bind(this))
      .onSet(this.handleTargetPositionSet.bind(this));

  }

  /**
     * Handle requests to get the current value of the "Current Position" characteristic
     */
  handleCurrentPositionGet() {
    //this.accessory.context.device.log.debug('handleCurrentPositionGet:', this.currentPosition);

    // set this to a valid value for CurrentPosition
    return this.currentPosition;
  }

  /**
   * Handle requests to get the current value of the "Position State" characteristic
   */
  handlePositionStateGet() {
    //this.accessory.context.device.log.debug('handlePositionStateGet:', this.positionState);

    // set this to a valid value for PositionState
    return this.positionState;
  }

  /**
   * Handle requests to get the current value of the "Target Position" characteristic
   */
  handleTargetPositionGet() {
    //this.accessory.context.device.log.debug('handleTargetPositionGet:', this.targetPosition);

    // set this to a valid value for TargetPosition
    return this.targetPosition;
  }

  /**
   * Handle requests to set the "Target Position" characteristic
   */
  handleTargetPositionSet(value) {
    //this.accessory.context.device.log.debug('handleTargetPositionSet:', value);
    //this.accessory.context.device.log.debug('Zone:', this.accessory.context.device.zone);

    if (value < 33) {
      value = 0;
    }
    if ((value >= 33) && (value <= 67)) {
      value = 50;
    }
    if (value > 67) {
      value = 100;
    }
    if (this.targetPosition !== value) {
      this.targetPosition = value;
      //this.accessory.context.device.log.debug('Target: ', this.accessory.context.device.target);
      const target = this.accessory.context.device.target;
      //this.accessory.context.device.log.debug('Duration: ', this.accessory.context.device.duration);
      const duration = this.accessory.context.device.duration;
      if (((target === undefined) && (duration === undefined) && (value === 0)) || this.waiting) {
        this.platform.client.write('Security_system::OutputOff(OutputNumber = ' + this.getId() + ')\n');
        if (target !== undefined && (100 - target) !== this.targetPosition) {
          this.targetPosition = (100 - target);
          this.service.getCharacteristic(this.platform.Characteristic.TargetPosition).setValue(100 - target);
        }
        if (this.waiting === true) {
          clearTimeout(this.timeout);
          this.waiting = false;
        }
      } else if (((target === undefined) && (duration === undefined) && (value === 100)) || !this.waiting) {
        for (const output in this.platform.zone_outputs[this.accessory.context.device.zone]) {
          if (Number(output) !== this.getId()) {
            this.platform.outputs[output].abort();
          }
        }
        this.platform.client.write('Security_system::OutputOn(OutputNumber = ' + this.getId() + ')\n');
        if (target !== undefined && target !== this.targetPosition) {
          this.targetPosition = target;
          this.service.getCharacteristic(this.platform.Characteristic.TargetPosition).setValue(target);
        }
        if (duration !== undefined) {
          this.waiting = true;
          this.timeout = setTimeout(() => this.stopWaiting(this), duration * 1000);
        }
      }
      this.doUpdate();
    }
  }

  stopWaiting(_this: this) {
    //_this.platform.log.info(this.getId() +' - stopWaiting');
    _this.waiting = false;
    _this.doUpdate();
  }

  setZoneState(state: boolean) {
    //this.platform.log.info(this.getId() +' - setZoneState:', state);
    if (state !== this.zoneState) {
      this.zoneState = state;
      this.doUpdate();
    }
  }

  setOutputState(state: boolean) {
    //this.platform.log.info(this.getId() +' - setOutputState:', state);
    if (state !== this.outputState) {
      this.outputState = state;
      if ((this.accessory.context.device.zone === undefined) || (this.accessory.context.device.zone === 0)) {
        this.zoneState = state;
      }
      this.doUpdate();
    }
  }

  abort() {
    if (this.waiting === true) {
      clearTimeout(this.timeout);
      this.waiting = false;
    }
    this.platform.client.write('Security_system::OutputOff(OutputNumber = ' + this.getId() + ')\n');
  }

  doUpdate() {
    //this.platform.log.info(this.getId() +' - doUpdate: ' + (this.waiting ? '' : '!') + 'waiting');
    let current;
    let target;

    if (this.waiting) {
      current = 100 - this.targetPosition;
      target = this.targetPosition;
    } else {
      //this.accessory.context.device.log.info('Duration: ', this.accessory.context.device.duration);
      //this.platform.log.info('zoneState:', this.zoneState);
      //this.platform.log.info('outputState:', this.outputState);
      if (this.accessory.context.device.duration === undefined) {
        current = this.zoneState ? 100 : 0;
        target = this.outputState ? 100 : 0;
      } else {
        current = this.zoneState ? 100 : 0;
        target = current;
      }
    }
    const state = (target > current) ? 1 : ((target < current) ? 0 : 2);
    //this.platform.log.info('current:', current);
    //this.platform.log.info('target:', target);
    //this.platform.log.info('state:', state);

    if (current !== this.currentPosition) {
      this.currentPosition = current;
      this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition).setValue(current);
    }
    if (target !== this.targetPosition) {
      this.targetPosition = target;
      this.service.getCharacteristic(this.platform.Characteristic.TargetPosition).setValue(target);
    }
    if (state !== this.positionState) {
      this.positionState = state;
      this.service.getCharacteristic(this.platform.Characteristic.PositionState).setValue(state);
    }
  }

  getId() {
    return this.accessory.context.device.id;
  }
}
