import { Module } from '@nestjs/common';
import { BugsController } from './bugs.controller.js';
import { BugsService } from './bugs.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [BugsController],
  providers: [BugsService],
  exports: [BugsService],
})
export class BugsModule {}
