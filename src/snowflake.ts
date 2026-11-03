const EPOCH = Date.UTC(2026, 0, 1);
const MAX_MACHINE_ID = 1023;
const MAX_SEQUENCE = 4095;

export class Snowflake {
  private lastTimestamp = -1;
  private sequence = 0;

  constructor(private readonly machineId: number) {
    if (
      !Number.isInteger(machineId) ||
      machineId < 0 ||
      machineId > MAX_MACHINE_ID
    ) {
      throw new Error(`Machine ID must be between 0 and ${MAX_MACHINE_ID}`);
    }
  }

  nextId(): bigint {
    let now = Date.now();

    if (now < this.lastTimestamp) {
      throw new Error("Clock moved backwards");
    }

    if (now === this.lastTimestamp) {
      this.sequence++;

      if (this.sequence > MAX_SEQUENCE) {
        while (now <= this.lastTimestamp) {
          now = Date.now();
        }
        this.sequence = 0;
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = now;

    return (
      (BigInt(now - EPOCH) << 22n) |
      (BigInt(this.machineId) << 12n) |
      BigInt(this.sequence)
    );
  }
}
