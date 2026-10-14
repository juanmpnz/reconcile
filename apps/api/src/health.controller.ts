import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthService } from './health.service.js';
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}
  @Get('live') live(): { status: string } {
    return { status: 'alive' };
  }
  @Get('ready') async ready() {
    const result = await this.health.ready();
    if (result.status !== 'ready')
      throw new ServiceUnavailableException(result);
    return result;
  }
}
