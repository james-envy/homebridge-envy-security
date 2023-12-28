import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SecuritySystem } from './SecuritySystem';
import { MotionSensor } from './MotionSensor';
import { ContactSensor } from './ContactSensor';
import { Door } from './Door';
import { GarageDoorOpener } from './GarageDoorOpener';
import { Switch } from './Switch';
import { Task } from './Task';

import { Socket } from 'net';

/**
* HomebridgePlatform
* This class is the main constructor for your plugin, this is where you should
* parse the user config and discover/register accessories with Homebridge.
*/
enum AccessoryType {
  MOTION_SENSOR = 1,
  CONTACT_SENSOR = 2,
  DOOR = 3,
  GARAGE_DOOR_OPENER = 4,
  SWITCH = 5
}

export class EnvySecurityPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  
  private partitions = {};
  
  private partition_zones = {};
  private zones = {};
  private zone_types = {};
  
  private partition_outputs = {};
  outputs = {};
  private output_types = {};
  
  zone_outputs = {};
  
  tasks = {};
  
  client = new Socket;
  private client_data = '';
  
  private ready_timer;
  
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  
  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
    ) {
      //this.log.debug('Finished initializing platform:', this.config.name);
      
      // When this event is fired it means Homebridge has restored all cached accessories from disk.
      // Dynamic Platform plugins should only register new accessories after this event was fired,
      // in order to ensure they weren't added to homebridge already. This event can also be used
      // to start discovery of new accessories.
      this.api.on('didFinishLaunching', () => {
        //log.debug('Executed didFinishLaunching callback');
        // run the method to discover / register your devices as accessories
        this.discoverDevices();
        
        this.client.on('close', () => {
          this.on_close(this);
        });
        this.client.on('timeout', () => {
          this.on_timeout(this);
        });
        this.client.on('error', () => {
          this.on_error(this);
        });
        this.client.on('connect', () => {
          this.on_connect(this);
        });
        this.client.on('ready', () => {
          this.on_ready(this);
        });
        this.client.on('data', (data) => {
          this.on_data(this, data);
        });
        this.client.setTimeout(60000);
        //this.log.info('alarmType:', this.config.alarmType);
        if (this.config.alarmType === 'HOMEBRIDGE') {
          this.client.connect(this.config.securityPort, this.config.securityAddress);
          //this.log.info(this.config.securityPort + ':' + this.config.securityAddress);
        } else if (typeof(this.config.javaPort) === 'undefined') {
          this.client.connect(12321);
          //this.log.info(12321 + '[:' + localhost + ']');
        } else {
          this.client.connect(this.config.javaPort, this.config.javaAddress);
          //this.log.info(this.config.javaPort + ':' + this.config.javaAddress);
        }
      });
    }
    
    on_timeout(_this: this) : void {
      _this.log.info('TIMEOUT');
      _this.client.destroy();
    }
    
    on_close(_this: this) : void {
      _this.log.info('CLOSE');
      if (typeof _this.ready_timer !== undefined) {
        _this.log.info('*** CANCELLING TIMEOUT ***');
        clearTimeout(_this.ready_timer);
        _this.ready_timer = undefined;
      }
      setTimeout(() => {
        //_this.log.info('alarmType:', _this.config.alarmType);
        if (_this.config.alarmType === 'HOMEBRIDGE') {
          _this.client.connect(_this.config.securityPort, _this.config.securityAddress);
          //_this.log.info(_this.config.securityPort + ':' + _this.config.securityAddress);
        }  else if (typeof(this.config.javaPort) === 'undefined') {
          this.client.connect(12322);
          //this.log.info(12321 + '[:' + localhost + ']');
        } else {
          _this.client.connect(this.config.javaPort, this.config.javaAddress);
          //_this.log.info(this.config.javaPort + ':' + this.config.javaAddress);
        }
      }, 10000);
    }
    
    on_error(_this: this) : void {
      _this.log.info('ERROR');
    }
    
    on_connect(_this: this) : void {
      _this.log.info('CONNECTED');
    }
    
    on_ready(_this: this) : void {
      _this.log.info('READY');
      _this.client.write('Security_system::UpdateSecurityStatus(ControllerType = ' + _this.config.alarmType + ', ControllerAddress = '
      + _this.config.securityAddress + ':' + _this.config.securityPort + ', ReadyZones = ' + _this.config.readyZones
      + ', AlarmZones = ' + _this.config.alarmZones + ')\n');
      _this.ready_timer = setTimeout(() => {
        _this.on_ready(_this);
      }, 15000);
    }
    
    on_data(_this: this, data: Buffer) : void {
      _this.client_data += data;
      let i = _this.client_data.indexOf('\n');
      while (i !== -1) {
        const line = _this.client_data.substring(0, i);
        _this.client_data = _this.client_data.substring(i + 1);
        _this.log.info('DATA "' + line + '"');
        let result;
        result = line.match(/^Security_system::PartitionStatus\(PartitionNumber = (\d+), CurrentPartitionArmingStatus = (.+)\)$/);
        if (result !== null) {
          //_this.log.info('1: ' + result[1] + ' 2: ' + result[2]);
          const partition: SecuritySystem = _this.partitions[result[1]];
          if (partition !== undefined) {
            partition.setSecuritySystemCurrentState(result[2]);
            partition.setSecuritySystemTargetState(result[2]);
          }
        }
        result = line.match(/^Security_system::PartitionEvent\(PartitionNumber = (\d+), CurrentPartitionArmingEvent = (.+)\)$/);
        if (result !== null) {
          //_this.log.info('1: ' + result[1] + ' 2: ' + result[2]);
          const partition: SecuritySystem = _this.partitions[result[1]];
          if (partition !== undefined) {
            partition.setSecuritySystemCurrentState(result[2]);
            partition.setSecuritySystemTargetState(result[2]);
          }
        }
        result = line.match(/^Security_system::PartitionReady\(PartitionNumber = (\d+), IsPartitionReady = (.+)\)$/);
        if (result !== null) {
          //_this.log.info('1: ' + result[1] + ' 2: ' + result[2]);
        }
        result = line.match(/^Security_system::PartitionAlarm\(PartitionNumber = (\d+), IsPartitionAlarmActive = (.+)\)$/);
        if (result !== null) {
          //_this.log.info('1: ' + result[1] + ' 2: ' + result[2]);
          const partition: SecuritySystem = _this.partitions[result[1]];
          if (partition !== undefined) {
            switch (result[2]) {
              case 'true':
              partition.setSecuritySystemCurrentStateNum(this.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED);
              break;
            }
          }
          result = line.match(/^Security_system::PartitionAlarm\(PartitionNumber = (\d+), IsPartitionAlarmActive = (.+)\)$/);
          if (result !== null) {
            //_this.log.info('1: ' + result[1] + ' 2: ' + result[2]);
            const partition: SecuritySystem = _this.partitions[result[1]];
            if (partition !== undefined) {
              switch (result[2]) {
                case 'true':
                partition.setSecuritySystemCurrentStateNum(this.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED);
                break;
              }
            }
          }
          result = line.match(/^Security_system::ZoneStatus\(ZoneNumber = (\d+), CurrentZoneStatus = (.+), ZoneSummary = (\d+)\)$/);
          if (result !== null) {
            //_this.log.info('1: ' + result[1] + ' 2: ' + result[2] + ' 3: ' + result[3]);
            const zone = _this.zones[result[1]];
            if (zone !== undefined) {
              //_this.log.info('zone_type:', _this.zone_types[result[1]]);
              switch (_this.zone_types[result[1]]) {
                case AccessoryType.MOTION_SENSOR:
                switch (result[2]) {
                  case 'Sealed':
                  zone.setMotionDetected(false);
                  break;
                  case 'Unsealed':
                  zone.setMotionDetected(true);
                  break;
                }
                break;
                case AccessoryType.CONTACT_SENSOR:
                switch (result[2]) {
                  case 'Sealed':
                  zone.setContactSensorState(false);
                  break;
                  case 'Unsealed':
                  zone.setContactSensorState(true);
                  break;
                }
                break;
              }
            }
            const outputs = _this.zone_outputs[result[1]];
            for (const o in outputs) {
              //_this.log.info('output:', o);
              const output = _this.outputs[o];
              if (output !== undefined) {
                //_this.log.info('output.zone:', output.accessory.context.device.zone);
                //_this.log.info('output_type:', _this.output_types[o]);
                switch (_this.output_types[o]) {
                  case AccessoryType.DOOR:
                  case AccessoryType.GARAGE_DOOR_OPENER:
                  case AccessoryType.SWITCH:
                  switch (result[2]) {
                    case 'Sealed':
                    output.setZoneState(false);
                    break;
                    case 'Unsealed':
                    output.setZoneState(true);
                    break;
                  }
                  break;
                }
              }
            }
          }
          result = line.match(/^Security_system::ZoneBypass\(ZoneNumber = (\d+), IsZoneBypassed = (.+)\)$/);
          if (result !== null) {
            //_this.log.info('1: ' + result[1] + ' 2: ' + result[2]);
          }
          result = line.match(/^Security_system::OutputStatus\(OutputNumber = (\d+), IsOutputOn = (.+)\)$/);
          if (result !== null) {
            //_this.log.info('1: ' + result[1] + ' 2: ' + result[2]);
            const output = _this.outputs[result[1]];
            if (output !== undefined) {
              switch (result[2]) {
                case 'false':
                output.setOutputState(false);
                break;
                case 'true':
                output.setOutputState(true);
                break;
              }
            }
          }
          i = _this.client_data.indexOf('\n');
        }
      }
    }
    
    /**
    * This function is invoked when homebridge restores cached accessories from disk at startup.
    * It should be used to setup event handlers for characteristics and update respective values.
    */
    configureAccessory(accessory: PlatformAccessory) : void {
      //this.log.info('Loading accessory from cache:', accessory.displayName);
      
      // add the restored accessory to the accessories cache so we can track if it has already been registered
      this.accessories.push(accessory);
    }
    
    /**
    * This is an example method showing how to register discovered accessories.
    * Accessories must only be registered once, previously created accessories
    * must not be registered again to prevent "duplicate UUID" errors.
    */
    discoverDevices() : void {
      
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      
      for (const partition of this.config.partitions) {
        this.partition_zones[partition.number] = {};
        this.partition_outputs[partition.number] = {};
        //this.log.info('Creating partition:', partition.number);
        const device = {
          id: partition.number,
          code: partition.code,
          uniqueId: 'envy-security-partition' + partition.number,
          displayName: partition.name,
          stay_mode: partition.stay_mode,
          away_mode: partition.away_mode,
          night_mode: partition.night_mode,
          log: this.log,
        };
        
        const uuid = this.api.hap.uuid.generate(device.uniqueId);
        
        //for (const existingAccessory of this.accessories) {
        //  this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        //}
        
        // see if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
        
        if (existingAccessory) {
          // the accessory already exists
          //this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          
          existingAccessory.context.device = device;
          
          // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
          // existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);
          
          // create the accessory handler for the restored accessory
          // this is imported from `platformAccessory.ts`
          this.partitions[partition.number] = new SecuritySystem(this, existingAccessory);
          
          // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
          // remove platform accessories when no longer present
          // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
          // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
        } else {
          // the accessory does not yet exist, so we need to create it
          //this.log.info('Adding new accessory:', this.config);
          
          // create a new accessory
          const accessory = new this.api.platformAccessory(device.displayName, uuid);
          
          // store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          accessory.context.device = device;
          
          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          this.partitions[partition.number] = new SecuritySystem(this, accessory);
          
          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        
        for (const zone of partition.zones) {
          this.partition_zones[partition.number][zone.number] = zone.type;
          this.zone_types[zone.number] = zone.type;
          //this.log.info('Creating zone:', zone.number);
          const device = {
            id: zone.number,
            uniqueId: 'envy-security-zone' + zone.number,
            displayName: zone.name,
            log: this.log,
          };
          
          const uuid = this.api.hap.uuid.generate(device.uniqueId);
          
          //for (const existingAccessory of this.accessories) {
          //  this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
          //}
          
          // see if an accessory with the same uuid has already been registered and restored from
          // the cached devices we stored in the `configureAccessory` method above
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
          
          if (existingAccessory) {
            // the accessory already exists
            //this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            
            existingAccessory.context.device = device;
            
            // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
            // existingAccessory.context.device = device;
            this.api.updatePlatformAccessories([existingAccessory]);
            
            // create the accessory handler for the restored accessory
            // this is imported from `platformAccessory.ts`
            switch (zone.type) {
              case AccessoryType.MOTION_SENSOR:
              this.zones[zone.number] = new MotionSensor(this, existingAccessory);
              break;
              case AccessoryType.CONTACT_SENSOR:
              this.zones[zone.number] = new ContactSensor(this, existingAccessory);
              break;
            }
            
            // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
            // remove platform accessories when no longer present
            // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
            // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
          } else {
            // the accessory does not yet exist, so we need to create it
            //this.log.info('Adding new accessory:', this.config);
            
            // create a new accessory
            const accessory = new this.api.platformAccessory(device.displayName, uuid);
            
            // store a copy of the device object in the `accessory.context`
            // the `context` property can be used to store any data about the accessory you may need
            accessory.context.device = device;
            
            // create the accessory handler for the newly create accessory
            // this is imported from `platformAccessory.ts`
            switch (zone.type) {
              case AccessoryType.MOTION_SENSOR:
              this.zones[zone.number] = new MotionSensor(this, accessory);
              break;
              case AccessoryType.CONTACT_SENSOR:
              this.zones[zone.number] = new ContactSensor(this, accessory);
              break;
            }
            
            // link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        }
        
        for (const output of partition.outputs) {
          this.partition_outputs[partition.number][output.number] = output.type;
          this.output_types[output.number] = output.type;
          if (output.zone !== undefined && output.zone !== 0) {
            if (this.zone_outputs[output.zone] === undefined) {
              this.zone_outputs[output.zone] = {};
            }
            this.zone_outputs[output.zone][output.number] = output.type;
          }
          //this.log.info('Creating output:', output.number);
          const device = {
            id: output.number,
            duration: output.duration,
            target: output.target,
            zone: output.zone,
            uniqueId: 'envy-security-output' + output.number,
            displayName: output.name,
            log: this.log,
          };
          
          const uuid = this.api.hap.uuid.generate(device.uniqueId);
          
          //for (const existingAccessory of this.accessories) {
          //  this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
          //}
          
          // see if an accessory with the same uuid has already been registered and restored from
          // the cached devices we stored in the `configureAccessory` method above
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
          
          if (existingAccessory) {
            // the accessory already exists
            //this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            
            existingAccessory.context.device = device;
            
            // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
            // existingAccessory.context.device = device;
            this.api.updatePlatformAccessories([existingAccessory]);
            
            // create the accessory handler for the restored accessory
            // this is imported from `platformAccessory.ts`
            switch (output.type) {
              case AccessoryType.DOOR:
              this.outputs[output.number] = new Door(this, existingAccessory);
              break;
              case AccessoryType.GARAGE_DOOR_OPENER:
              this.outputs[output.number] = new GarageDoorOpener(this, existingAccessory);
              break;
              case AccessoryType.SWITCH:
              this.outputs[output.number] = new Switch(this, existingAccessory);
              break;
            }
            
            // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
            // remove platform accessories when no longer present
            // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
            // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
          } else {
            // the accessory does not yet exist, so we need to create it
            //this.log.info('Adding new accessory:', this.config);
            
            // create a new accessory
            const accessory = new this.api.platformAccessory(device.displayName, uuid);
            
            // store a copy of the device object in the `accessory.context`
            // the `context` property can be used to store any data about the accessory you may need
            accessory.context.device = device;
            
            // create the accessory handler for the newly create accessory
            // this is imported from `platformAccessory.ts`
            switch (output.type) {
              case AccessoryType.DOOR:
              this.outputs[output.number] = new Door(this, accessory);
              break;
              case AccessoryType.GARAGE_DOOR_OPENER:
              this.outputs[output.number] = new GarageDoorOpener(this, accessory);
              break;
              case AccessoryType.SWITCH:
              this.outputs[output.number] = new Switch(this, accessory);
              break;
            }
            
            // link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        }
      }
      
      for (const task of this.config.tasks) {
        this.tasks[task.number] = {};
        //this.log.info('Creating task:', task.number);
        const device = {
          id: task.number,
          uniqueId: 'envy-security-task' + task.number,
          displayName: task.name,
          log: this.log,
        };
        
        const uuid = this.api.hap.uuid.generate(device.uniqueId);
        
        //for (const existingAccessory of this.accessories) {
        //  this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        //}
        
        // see if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
        
        if (existingAccessory) {
          // the accessory already exists
          //this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          
          existingAccessory.context.device = device;
          
          // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
          // existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);
          
          // create the accessory handler for the restored accessory
          // this is imported from `platformAccessory.ts`
          this.tasks[task.number] = new Task(this, existingAccessory);
          
          // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
          // remove platform accessories when no longer present
          // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
          // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
        } else {
          // the accessory does not yet exist, so we need to create it
          //this.log.info('Adding new accessory:', this.config);
          
          // create a new accessory
          const accessory = new this.api.platformAccessory(device.displayName, uuid);
          
          // store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          accessory.context.device = device;
          
          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          this.tasks[task.number] = new Task(this, accessory);
          
          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }
      
      //for (const partition in this.partition_zones) {
      //this.log.info('Mapped partition:', partition, ' name: ', this.partitions[partition].accessory.context.device.displayName);
      //for (const zone in this.partition_zones[partition]) {
      //this.log.info('Mapped zone:', zone, ' name: ', this.zones[zone].accessory.context.device.displayName);
      //}
      //}
    }
  }
  
  